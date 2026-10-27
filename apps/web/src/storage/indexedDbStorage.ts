import { fromAppData, isLocalRecord } from './records';
import { readLegacyRecord } from './schema';
import {
  STORAGE_VERSION,
  type BoardStorage,
  type LoadResult,
  type LocalRecord,
  type StorageChanges,
  type UnreadableCopy,
} from './storage';

const DATABASE = 'bingogoals';
const DATABASE_VERSION = 2;

/** Registro único de las versiones 1 y 2, y copias de datos ilegibles. */
const STATE = 'state';
/** Un registro por tablero, con su identificador como clave. */
const BOARDS = 'boards';
/** Versión del formato, tablero activo y cursores de sincronización. */
const META = 'meta';

const LEGACY_KEY = 'app';
const UNREADABLE_KEY_PREFIX = 'unreadable-';
const CHANNEL = 'bingogoals-storage';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const name of [STATE, META]) {
        if (!database.objectStoreNames.contains(name)) {
          database.createObjectStore(name);
        }
      }
      if (!database.objectStoreNames.contains(BOARDS)) {
        database.createObjectStore(BOARDS, { keyPath: 'board.id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Base de datos bloqueada.'));
  });
}

function read<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Ejecuta una función dentro de una transacción sobre todos los almacenes y
 * espera a que la transacción termine. Si algo falla, no se guarda nada.
 */
async function transact<T>(
  mode: IDBTransactionMode,
  work: (stores: {
    state: IDBObjectStore;
    boards: IDBObjectStore;
    meta: IDBObjectStore;
  }) => Promise<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction([STATE, BOARDS, META], mode);
    const done = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      // Por ejemplo, cuando el dispositivo se queda sin espacio.
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('Transacción cancelada.'));
    });
    let result: T;
    try {
      result = await work({
        state: transaction.objectStore(STATE),
        boards: transaction.objectStore(BOARDS),
        meta: transaction.objectStore(META),
      });
    } catch (error) {
      transaction.abort();
      throw error;
    }
    await done;
    return result;
  } finally {
    database.close();
  }
}

function copyKey(suffix = ''): string {
  return `${UNREADABLE_KEY_PREFIX}${new Date().toISOString()}${suffix}`;
}

/**
 * Almacenamiento en el propio dispositivo, sobre IndexedDB. Avisa a las demás
 * pestañas de cada cambio con un BroadcastChannel.
 */
export function createIndexedDbStorage(): BoardStorage {
  const channel =
    typeof BroadcastChannel === 'undefined'
      ? null
      : new BroadcastChannel(CHANNEL);

  return {
    load: () =>
      transact(
        'readwrite',
        async ({ state, boards, meta }): Promise<LoadResult> => {
          if ((await read(meta.get('version'))) === STORAGE_VERSION) {
            const records: LocalRecord[] = [];
            let skipped = 0;
            const stored = await read(boards.getAll());
            for (const [index, value] of stored.entries()) {
              if (isLocalRecord(value)) {
                records.push(value);
              } else {
                // Se aparta como copia, sin borrarla, y el resto se carga.
                state.put(value, copyKey(`-${index}`));
                const key = (value as { board?: { id?: unknown } })?.board?.id;
                if (typeof key === 'string') {
                  boards.delete(key);
                }
                skipped++;
              }
            }
            const activeBoardId = await read(meta.get('activeBoardId'));
            const syncCursors = await read(meta.get('syncCursors'));
            return {
              status: 'loaded',
              skipped,
              data: {
                records,
                activeBoardId:
                  typeof activeBoardId === 'string' ? activeBoardId : null,
                syncCursors:
                  syncCursors && typeof syncCursors === 'object'
                    ? (syncCursors as Record<string, string>)
                    : {},
              },
            };
          }

          // Datos de las versiones 1 y 2, en un único registro.
          const legacy = readLegacyRecord(await read(state.get(LEGACY_KEY)));
          if (legacy.status === 'unreadable') {
            // No se toca nada hasta que el usuario cambie algo.
            return legacy;
          }
          meta.put(STORAGE_VERSION, 'version');
          if (legacy.status === 'empty') {
            return legacy;
          }
          const data = fromAppData(legacy.data);
          for (const record of data.records) {
            boards.put(record);
          }
          meta.put(data.activeBoardId, 'activeBoardId');
          // Ya está migrado y validado: el registro antiguo sobra.
          state.delete(LEGACY_KEY);
          return { status: 'loaded', data, skipped: 0 };
        },
      ),

    async apply(changes: StorageChanges) {
      await transact('readwrite', async ({ state, boards, meta }) => {
        if ((await read(meta.get('version'))) !== STORAGE_VERSION) {
          // Lo que hubiera era ilegible: se conserva como copia.
          const legacy = await read(state.get(LEGACY_KEY));
          if (legacy !== undefined) {
            state.put(legacy, copyKey());
            state.delete(LEGACY_KEY);
          }
          meta.put(STORAGE_VERSION, 'version');
        }
        for (const record of changes.put ?? []) {
          boards.put(record);
        }
        for (const id of changes.remove ?? []) {
          boards.delete(id);
        }
        if (changes.activeBoardId !== undefined) {
          meta.put(changes.activeBoardId, 'activeBoardId');
        }
        if (changes.syncCursor) {
          const cursors =
            ((await read(meta.get('syncCursors'))) as Record<string, string>) ??
            {};
          meta.put(
            {
              ...cursors,
              [changes.syncCursor.userId]: changes.syncCursor.cursor,
            },
            'syncCursors',
          );
        }
      });
      channel?.postMessage(changes);
    },

    subscribe(listener) {
      if (!channel) {
        return () => {};
      }
      const handle = (event: MessageEvent<StorageChanges>) =>
        listener(event.data);
      channel.addEventListener('message', handle);
      return () => channel.removeEventListener('message', handle);
    },

    unreadableCopies: () =>
      transact('readonly', async ({ state }) => {
        const keys = (await read(state.getAllKeys())).filter(
          (key): key is string =>
            typeof key === 'string' && key.startsWith(UNREADABLE_KEY_PREFIX),
        );
        const copies: UnreadableCopy[] = [];
        for (const key of keys) {
          copies.push({ key, raw: await read(state.get(key)) });
        }
        return copies;
      }),
  };
}
