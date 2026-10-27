import { fromAppData, isLocalRecord } from './records';
import { readLegacyRecord } from './schema';
import {
  type BoardStorage,
  type LoadResult,
  type LocalRecord,
  type StorageChanges,
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
  /** Cada pestaña, con la función que le entrega los avisos. */
  tabs: Map<MemoryStorage, (changes: StorageChanges) => void>;
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
}

function createTab(device: Device): MemoryStorage {
  const listeners = new Set<(changes: StorageChanges) => void>();

  const tab: MemoryStorage = {
    records: device.records,
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
    tabs: new Map(),
  });
}

/** Copias de datos ilegibles de un almacenamiento en memoria, para los tests. */
export async function copiesOf(storage: BoardStorage) {
  return (await storage.unreadableCopies()).map((copy) => copy.raw);
}
