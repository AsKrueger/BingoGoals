import {
  EMPTY_COLLECTION,
  EMPTY_HISTORY,
  type BingoBoard,
  type BoardCollection,
  type BoardHistory,
  type PhotoType,
} from '@bingogoals/domain';

/** Lo que muestran las pantallas: tableros activos, el activo e historial. */
export interface AppData {
  readonly collection: BoardCollection;
  readonly history: BoardHistory;
}

export const EMPTY_DATA: AppData = {
  collection: EMPTY_COLLECTION,
  history: EMPTY_HISTORY,
};

/**
 * Versión del formato de los datos guardados en el dispositivo.
 *
 * - 1 y 2: todos los datos en un único registro (ver schema.ts).
 * - 3: un registro por tablero, con lo que necesita la sincronización.
 * - 4: las fotos se guardan aparte, como archivo; la casilla lleva su
 *   identificador (`photoId`) en lugar de la foto incrustada (`imagePath`).
 */
export const STORAGE_VERSION = 4;

/** Un tablero tal como se guarda en el dispositivo. */
export interface LocalRecord {
  readonly board: BingoBoard;
  /** Fecha de archivo, o null si está activo. */
  readonly archivedAt: string | null;
  /**
   * Fecha de borrado, o null. Un tablero borrado se conserva así hasta que
   * el servidor recibe el borrado.
   */
  readonly deletedAt: string | null;
  /** Cuenta a la que pertenece, o null si se creó sin sesión. */
  readonly ownerId: string | null;
  /** true si tiene cambios que el servidor todavía no ha recibido. */
  readonly pending: boolean;
}

/** Todo lo guardado en el dispositivo. */
export interface LocalData {
  readonly records: readonly LocalRecord[];
  readonly activeBoardId: string | null;
  /** Por cuenta, desde cuándo pedir cambios al servidor. */
  readonly syncCursors: Readonly<Record<string, string>>;
}

export const EMPTY_LOCAL_DATA: LocalData = {
  records: [],
  activeBoardId: null,
  syncCursors: {},
};

/** Cambios que se guardan de una vez. */
export interface StorageChanges {
  /** Tableros nuevos o cambiados, enteros. */
  readonly put?: readonly LocalRecord[];
  /** Tableros que se quitan del dispositivo del todo. */
  readonly remove?: readonly string[];
  readonly activeBoardId?: string | null;
  readonly syncCursor?: { readonly userId: string; readonly cursor: string };
}

/**
 * Resultado de leer lo guardado. «Sin datos» y «datos ilegibles» son casos
 * distintos: en el segundo hay algo guardado que no se debe perder.
 */
export type LoadResult =
  /** No hay nada guardado: es la primera visita o se borraron los datos. */
  | { readonly status: 'empty' }
  | {
      readonly status: 'loaded';
      readonly data: LocalData;
      /** Tableros que no se pudieron leer y se apartaron como copias. */
      readonly skipped: number;
    }
  /** Hay algo guardado, pero está corrupto o es de una versión desconocida. */
  | { readonly status: 'unreadable' };

/** Una copia de datos que no se pudieron leer, conservada tal cual. */
export interface UnreadableCopy {
  readonly key: string;
  readonly raw: unknown;
}

/** Una foto guardada en el dispositivo. */
export interface StoredPhoto {
  readonly id: string;
  readonly type: PhotoType;
  /** El archivo, tal cual. */
  readonly bytes: ArrayBuffer;
  /** Cuándo llegó al dispositivo: se elige, se descarga o se migra. */
  readonly savedAt: string;
  /** Cuenta que ya la tiene en el servidor, o null si no se ha subido. */
  readonly uploadedBy: string | null;
}

/** Lo que se sabe de una foto guardada, sin el archivo. */
export type PhotoInfo = Omit<StoredPhoto, 'bytes'>;

export function photoInfo({
  id,
  type,
  savedAt,
  uploadedBy,
}: StoredPhoto): PhotoInfo {
  return { id, type, savedAt, uploadedBy };
}

/**
 * Dónde se guardan las fotos en el dispositivo, aparte de los tableros: así,
 * guardar un cambio en un tablero no reescribe sus fotos.
 */
export interface PhotoStorage {
  get(id: string): Promise<StoredPhoto | undefined>;
  put(photos: readonly StoredPhoto[]): Promise<void>;
  /** Anota que una cuenta ya tiene la foto en el servidor. */
  markUploaded(id: string, userId: string): Promise<void>;
  remove(ids: readonly string[]): Promise<void>;
  /** Identificadores de las fotos guardadas. */
  ids(): Promise<string[]>;
  list(): Promise<PhotoInfo[]>;
  /**
   * Avisa de las fotos guardadas por otras pestañas del mismo dispositivo.
   * Devuelve la función que deja de escuchar.
   */
  subscribe(listener: (ids: string[]) => void): () => void;
}

/**
 * Dónde se guardan los datos en el dispositivo. Las pantallas no la usan
 * directamente: pasan por el almacén de tableros (store/boardStore.ts).
 */
export interface BoardStorage {
  /** Rechaza si el almacenamiento no está disponible. */
  load(): Promise<LoadResult>;
  /**
   * Guarda unos cambios. Si lo que había era un registro ilegible, antes
   * conserva una copia: los datos ilegibles no se borran nunca solos.
   */
  apply(changes: StorageChanges): Promise<void>;
  /**
   * Avisa de los cambios guardados por otras pestañas del mismo dispositivo.
   * Devuelve la función que deja de escuchar.
   */
  subscribe(listener: (changes: StorageChanges) => void): () => void;
  /** Copias de datos ilegibles conservadas en el dispositivo. */
  unreadableCopies(): Promise<UnreadableCopy[]>;
  /** Las fotos de las casillas. */
  readonly photos: PhotoStorage;
}
