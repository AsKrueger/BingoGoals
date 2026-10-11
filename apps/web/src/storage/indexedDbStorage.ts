import { parseStoredData, toStoredData } from './schema';
import type { AppData, BoardStorage } from './storage';

const DATABASE = 'bingogoals';
const STORE = 'state';
/** Todos los datos van en un único registro: se leen y se escriben a la vez. */
const KEY = 'app';

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

/** Ejecuta una operación en una transacción y espera a que termine. */
async function run<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE, mode);
      const request = operation(transaction.objectStore(STORE));
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
    async load(): Promise<AppData | null> {
      return parseStoredData(await run('readonly', (store) => store.get(KEY)));
    },
    async save(data: AppData): Promise<void> {
      await run('readwrite', (store) => store.put(toStoredData(data), KEY));
    },
  };
}
