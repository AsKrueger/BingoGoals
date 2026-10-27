import { photoTypeOf, type PhotoType } from '@bingogoals/domain';
import type { FileBody } from '../api/http';
import type { PhotoStorage, StoredPhoto } from '../storage/storage';

/**
 * Cuánto se conserva en el dispositivo una foto que ninguna casilla usa. Da
 * tiempo a que otra pestaña guarde el tablero que la acaba de recibir, y a
 * que se guarde la casilla mientras su diálogo sigue abierto.
 */
export const UNUSED_PHOTO_GRACE_MS = 24 * 60 * 60 * 1000;

/** Una foto nueva: el archivo y su tipo. */
export interface NewPhoto {
  readonly type: PhotoType;
  readonly bytes: ArrayBuffer;
}

export interface PhotoStore {
  /**
   * Dirección para mostrar la foto, o undefined si todavía no se ha cargado
   * o no está en el dispositivo.
   */
  url(id: string): string | undefined;
  /** Carga la foto del dispositivo, si no estaba ya cargada. */
  request(id: string): void;
  subscribe(listener: () => void): () => void;
  /** Guarda una foto nueva en el dispositivo y devuelve su identificador. */
  add(photo: NewPhoto): Promise<string>;
  /** Guarda fotos que ya tienen identificador: recuperadas o migradas. */
  addAll(photos: readonly StoredPhoto[]): Promise<void>;
  get(id: string): Promise<StoredPhoto | undefined>;
  /** Identificadores de las fotos que hay en el dispositivo. */
  ids(): Promise<Set<string>>;
  /** Guarda una foto descargada del servidor de una cuenta. */
  saveDownloaded(id: string, file: FileBody, userId: string): Promise<void>;
  /** Anota que una cuenta ya tiene la foto en el servidor. */
  markUploaded(id: string, userId: string): Promise<void>;
  /**
   * Borra las fotos que no están en `used` y llevan en el dispositivo más del
   * margen. Devuelve cuántas ha borrado.
   */
  collect(used: ReadonlySet<string>): Promise<number>;
  dispose(): void;
}

interface PhotoStoreOptions {
  now?: () => Date;
  toUrl?: (photo: StoredPhoto) => string;
  revokeUrl?: (url: string) => void;
}

/**
 * Fotos de las casillas en esta pestaña: guarda las nuevas en el dispositivo
 * y da a las pantallas una dirección para mostrar cada una, que solo se crea
 * cuando hace falta.
 */
export function createPhotoStore(
  storage: PhotoStorage,
  {
    now = () => new Date(),
    toUrl = (photo) =>
      URL.createObjectURL(new Blob([photo.bytes], { type: photo.type })),
    revokeUrl = (url) => URL.revokeObjectURL(url),
  }: PhotoStoreOptions = {},
): PhotoStore {
  /** Por foto, su dirección, o null si se buscó y no está en el dispositivo. */
  const urls = new Map<string, string | null>();
  const loading = new Set<string>();
  const listeners = new Set<() => void>();

  function emit() {
    for (const listener of listeners) {
      listener();
    }
  }

  function show(photo: StoredPhoto) {
    const previous = urls.get(photo.id);
    if (previous) {
      return;
    }
    urls.set(photo.id, toUrl(photo));
    emit();
  }

  function forget(id: string) {
    const url = urls.get(id);
    if (url) {
      revokeUrl(url);
    }
    urls.delete(id);
  }

  async function load(id: string) {
    loading.add(id);
    try {
      const photo = await storage.get(id);
      if (photo) {
        show(photo);
      } else if (!urls.has(id)) {
        urls.set(id, null);
        emit();
      }
    } catch {
      // Sin acceso al almacenamiento la casilla se muestra sin foto.
    } finally {
      loading.delete(id);
    }
  }

  async function save(photos: readonly StoredPhoto[]) {
    await storage.put(photos);
    for (const photo of photos) {
      show(photo);
    }
  }

  // Fotos guardadas por otras pestañas: las que aquí faltaban, se cargan.
  const unsubscribe = storage.subscribe((ids) => {
    for (const id of ids) {
      if (urls.get(id) === null) {
        void load(id);
      }
    }
  });

  return {
    url: (id) => urls.get(id) ?? undefined,

    request(id) {
      if (!urls.has(id) && !loading.has(id)) {
        void load(id);
      }
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async add({ type, bytes }) {
      const id = crypto.randomUUID();
      await save([
        { id, type, bytes, savedAt: now().toISOString(), uploadedBy: null },
      ]);
      return id;
    },

    addAll: save,

    get: (id) => storage.get(id),

    ids: async () => new Set(await storage.ids()),

    async saveDownloaded(id, file, userId) {
      // El tipo sale del contenido, como en la API.
      const type = photoTypeOf(new Uint8Array(file.bytes));
      if (!type) {
        return;
      }
      await save([
        {
          id,
          type,
          bytes: file.bytes,
          savedAt: now().toISOString(),
          uploadedBy: userId,
        },
      ]);
    },

    markUploaded: (id, userId) => storage.markUploaded(id, userId),

    async collect(used) {
      const limit = now().getTime() - UNUSED_PHOTO_GRACE_MS;
      const unused = (await storage.list())
        .filter(
          (photo) => !used.has(photo.id) && Date.parse(photo.savedAt) < limit,
        )
        .map((photo) => photo.id);
      if (unused.length > 0) {
        await storage.remove(unused);
        for (const id of unused) {
          forget(id);
        }
        emit();
      }
      return unused.length;
    },

    dispose() {
      unsubscribe();
      for (const id of [...urls.keys()]) {
        forget(id);
      }
    },
  };
}
