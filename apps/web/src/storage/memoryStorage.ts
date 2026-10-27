import { fromAppData, isLocalRecord } from './records';
import { readLegacyRecord } from './schema';
import {
  photoInfo,
  type BoardStorage,
  type LoadResult,
  type LocalRecord,
  type PhotoStorage,
  type StorageChanges,
  type StoredPhoto,
  type UnreadableCopy,
} from './storage';

/** Lo que comparten las pestañas de un mismo «dispositivo» en memoria. */
interface Device {
  /** Registro único de las versiones 1 y 2, si lo hay. */
  legacy: unknown;
  migrated: boolean;
  records: Map<string, unknown>;
  activeBoardId: string | null;
  syncCursors: Record<string, string>;
  copies: UnreadableCopy[];
  photos: Map<string, StoredPhoto>;
  /** Cada pestaña, con la función que le entrega los avisos. */
  tabs: Map<MemoryStorage, (changes: StorageChanges) => void>;
  /** Cada pestaña, con la función que le avisa de las fotos nuevas. */
  photoTabs: Map<PhotoStorage, (ids: string[]) => void>;
}

export interface MemoryStorage extends BoardStorage {
  /** Registros guardados tal cual, para inspeccionarlos o estropearlos. */
  readonly records: Map<string, unknown>;
  /** Registro único de las versiones 1 y 2, si queda alguno. */
  readonly legacy: () => unknown;
  readonly activeBoardId: () => string | null;
  /** Si es true, guardar falla, como cuando no queda espacio. */
  failOnSave: boolean;
  /** Si es true, cargar falla, como cuando el almacenamiento no responde. */
  failOnLoad: boolean;
  /** Otra pestaña del mismo dispositivo: comparte los datos y los avisos. */
  openTab(): MemoryStorage;
  /** Fotos guardadas tal cual, para inspeccionarlas. */
  readonly storedPhotos: Map<string, StoredPhoto>;
}

function createPhotoTab(device: Device): PhotoStorage {
  const listeners = new Set<(ids: string[]) => void>();
  const photos: PhotoStorage = {
    get: async (id) => {
      const photo = device.photos.get(id);
      return photo && structuredClone(photo);
    },
    async put(stored) {
      for (const photo of stored) {
        device.photos.set(photo.id, structuredClone(photo));
      }
      for (const [other, notify] of device.photoTabs) {
        if (other !== photos) {
          notify(stored.map((photo) => photo.id));
        }
      }
    },
    async markUploaded(id, userId) {
      const photo = device.photos.get(id);
      if (photo) {
        device.photos.set(id, { ...photo, uploadedBy: userId });
      }
    },
    async remove(ids) {
      for (const id of ids) {
        device.photos.delete(id);
      }
    },
    ids: async () => [...device.photos.keys()],
    list: async () => [...device.photos.values()].map(photoInfo),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  device.photoTabs.set(photos, (ids) => {
    for (const listener of listeners) {
      listener(ids);
    }
  });
  return photos;
}

function createTab(device: Device): MemoryStorage {
  const listeners = new Set<(changes: StorageChanges) => void>();

  const tab: MemoryStorage = {
    records: device.records,
    storedPhotos: device.photos,
    photos: createPhotoTab(device),
    legacy: () => device.legacy,
    activeBoardId: () => device.activeBoardId,
    failOnSave: false,
    failOnLoad: false,

    async load(): Promise<LoadResult> {
      if (tab.failOnLoad) {
        throw new Error('No se puede leer el almacenamiento.');
      }
      if (!device.migrated) {
        const legacy = readLegacyRecord(device.legacy);
        if (legacy.status === 'unreadable') {
          return legacy;
        }
        device.migrated = true;
        if (legacy.status === 'empty') {
          return legacy;
        }
        const data = fromAppData(legacy.data);
        for (const record of data.records) {
          device.records.set(record.board.id, structuredClone(record));
        }
        for (const photo of legacy.photos) {
          device.photos.set(photo.id, photo);
        }
        device.activeBoardId = data.activeBoardId;
        device.legacy = undefined;
      }
      const records: LocalRecord[] = [];
      let skipped = 0;
      for (const [id, value] of [...device.records]) {
        if (isLocalRecord(value)) {
          records.push(structuredClone(value));
        } else {
          device.copies.push({ key: `unreadable-${id}`, raw: value });
          device.records.delete(id);
          skipped++;
        }
      }
      return {
        status: 'loaded',
        skipped,
        data: {
          records,
          activeBoardId: device.activeBoardId,
          syncCursors: { ...device.syncCursors },
        },
      };
    },

    async apply(changes) {
      if (tab.failOnSave) {
        throw new Error('No queda espacio en el dispositivo.');
      }
      if (!device.migrated) {
        if (device.legacy !== undefined) {
          device.copies.push({ key: 'unreadable-legacy', raw: device.legacy });
          device.legacy = undefined;
        }
        device.migrated = true;
      }
      for (const record of changes.put ?? []) {
        device.records.set(record.board.id, structuredClone(record));
      }
      for (const id of changes.remove ?? []) {
        device.records.delete(id);
      }
      if (changes.activeBoardId !== undefined) {
        device.activeBoardId = changes.activeBoardId;
      }
      if (changes.syncCursor) {
        device.syncCursors[changes.syncCursor.userId] =
          changes.syncCursor.cursor;
      }
      // Como un BroadcastChannel: avisa a las demás pestañas, no a esta.
      for (const [other, notify] of device.tabs) {
        if (other !== tab) {
          notify(structuredClone(changes));
        }
      }
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async unreadableCopies() {
      return device.copies.map((copy) => ({ ...copy }));
    },

    openTab() {
      return createTab(device);
    },
  };

  device.tabs.set(tab, (changes) => {
    for (const listener of listeners) {
      listener(changes);
    }
  });
  return tab;
}

/**
 * Almacenamiento en memoria con el mismo comportamiento que el real: migra el
 * registro único antiguo, aparta lo ilegible y avisa a las demás pestañas.
 * Sirve para los tests. `legacy` simula datos de las versiones 1 y 2.
 */
export function createMemoryStorage(
  legacy: unknown = undefined,
): MemoryStorage {
  return createTab({
    legacy,
    migrated: legacy === undefined,
    records: new Map(),
    activeBoardId: null,
    syncCursors: {},
    copies: [],
    photos: new Map(),
    tabs: new Map(),
    photoTabs: new Map(),
  });
}

/** Copias de datos ilegibles de un almacenamiento en memoria, para los tests. */
export async function copiesOf(storage: BoardStorage) {
  return (await storage.unreadableCopies()).map((copy) => copy.raw);
}
