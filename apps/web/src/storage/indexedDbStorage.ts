import { readStoredData, toStoredData } from './schema';
import type { AppData, BoardStorage, LoadResult } from './storage';

const DATABASE = 'bingogoals';
const STORE = 'state';
/** Todos los datos van en un único registro: se leen y se escriben a la vez. */
const KEY = 'app';
/** Prefijo de las copias de registros ilegibles: `unreadable-<fecha ISO>`. */
const UNREADABLE_KEY_PREFIX = 'unreadable-';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Base de datos bloqueada.'));
  });
}

/**
 * Ejecuta varias operaciones en una sola transacción y espera a que termine.
 * Si algo falla, la transacción entera se deshace.
 */
async function transact<T>(
  mode: IDBTransactionMode,
  operations: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE, mode);
      const request = operations(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      // Por ejemplo, cuando el dispositivo se queda sin espacio.
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

/** Almacenamiento en el propio dispositivo, sobre IndexedDB. */
export function createIndexedDbStorage(): BoardStorage {
  return {
    async load(): Promise<LoadResult> {
      return readStoredData(
        await transact('readonly', (store) => store.get(KEY)),
      );
    },

    async save(data: AppData): Promise<void> {
      await transact('readwrite', (store) => {
        // Leer, copiar y escribir van en la misma transacción: o se hace
        // todo, o no se toca nada.
        const current = store.get(KEY);
        current.onsuccess = () => {
          if (readStoredData(current.result).status === 'unreadable') {
            store.put(
              current.result,
              UNREADABLE_KEY_PREFIX + new Date().toISOString(),
            );
          }
          store.put(toStoredData(data), KEY);
        };
        return current;
      });
    },
  };
}
