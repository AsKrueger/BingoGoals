// @vitest-environment node
import 'fake-indexeddb/auto';
import { createBoard, toggleCell } from '@bingogoals/domain';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, test } from 'vitest';
import storedV1 from './fixtures/stored-v1.json';
import { createIndexedDbStorage } from './indexedDbStorage';
import { toStoredData } from './schema';
import {
  STORAGE_VERSION,
  type LoadResult,
  type LocalData,
  type LocalRecord,
  type StorageChanges,
} from './storage';
import { sampleData } from './testData';

/** Abre la base de datos tal cual, sin pasar por la capa de almacenamiento. */
function openRaw(version = 2): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('bingogoals', version);
    open.onupgradeneeded = () => {
      const database = open.result;
      if (!database.objectStoreNames.contains('state')) {
        database.createObjectStore('state');
      }
      if (version >= 2) {
        for (const name of ['meta']) {
          if (!database.objectStoreNames.contains(name)) {
            database.createObjectStore(name);
          }
        }
        if (!database.objectStoreNames.contains('boards')) {
          database.createObjectStore('boards', { keyPath: 'board.id' });
        }
      }
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}

/** Guarda un registro único en el almacén `state`, como las versiones 1 y 2. */
async function writeLegacy(value: unknown) {
  // La base de datos de las versiones 1 y 2 tenía la versión 1 de IndexedDB.
  const database = await openRaw(1);
  await new Promise<void>((resolve) => {
    const transaction = database.transaction('state', 'readwrite');
    transaction.objectStore('state').put(value, 'app');
    transaction.oncomplete = () => resolve();
  });
  database.close();
}

/** Todo lo que hay en un almacén, como pares [clave, valor]. */
async function dump(name: 'state' | 'boards' | 'meta') {
  const database = await openRaw();
  const result = await new Promise<[IDBValidKey, unknown][]>((resolve) => {
    const store = database.transaction(name).objectStore(name);
    const keys = store.getAllKeys();
    const values = store.getAll();
    values.onsuccess = () =>
      resolve(keys.result.map((key, index) => [key, values.result[index]]));
  });
  database.close();
  return result;
}

/** Guarda un registro de tablero tal cual, aunque no tenga sentido. */
async function writeBoardRecord(value: unknown) {
  const database = await openRaw();
  await new Promise<void>((resolve) => {
    const transaction = database.transaction(['boards', 'meta'], 'readwrite');
    transaction.objectStore('boards').put(value);
    transaction.objectStore('meta').put(STORAGE_VERSION, 'version');
    transaction.oncomplete = () => resolve();
  });
  database.close();
}

function loaded(result: LoadResult): LocalData {
  if (result.status !== 'loaded') {
    throw new Error(`Se esperaban datos y la carga dio «${result.status}».`);
  }
  return result.data;
}

function record(
  board = createBoard('Metas', '3x3'),
  overrides: Partial<LocalRecord> = {},
): LocalRecord {
  return {
    board,
    archivedAt: null,
    deletedAt: null,
    ownerId: null,
    pending: false,
    ...overrides,
  };
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe('versión 3: un registro por tablero', () => {
  test('sin nada guardado, cargar dice que no hay datos', async () => {
    expect(await createIndexedDbStorage().load()).toEqual({ status: 'empty' });
  });

  test('cada tablero se guarda en su propio registro', async () => {
    const storage = createIndexedDbStorage();
    const first = record(createBoard('Primero', '3x3'));
    const second = record(createBoard('Segundo', '5x5'), {
      ownerId: 'usuario-1',
      pending: true,
    });

    await storage.apply({
      put: [first, second],
      activeBoardId: first.board.id,
    });

    const boards = await dump('boards');
    expect(boards.map(([key]) => key).sort()).toEqual(
      [first.board.id, second.board.id].sort(),
    );
    expect(await dump('meta')).toEqual(
      expect.arrayContaining([
        ['version', STORAGE_VERSION],
        ['activeBoardId', first.board.id],
      ]),
    );
  });

  test('carga lo que se guardó: tableros, activo y cursores', async () => {
    const storage = createIndexedDbStorage();
    const first = record(createBoard('Primero', '3x3'));
    const archived = record(createBoard('Archivado', '3x3'), {
      archivedAt: '2026-10-05T10:00:00.000Z',
    });
    await storage.apply({
      put: [first, archived],
      activeBoardId: first.board.id,
      syncCursor: { userId: 'usuario-1', cursor: '2026-10-20T10:00:00.000Z' },
    });

    const data = loaded(await createIndexedDbStorage().load());

    expect(data.records).toEqual(expect.arrayContaining([first, archived]));
    expect(data.records).toHaveLength(2);
    expect(data.activeBoardId).toBe(first.board.id);
    expect(data.syncCursors).toEqual({
      'usuario-1': '2026-10-20T10:00:00.000Z',
    });
  });

  test('cambiar un tablero solo reescribe ese tablero', async () => {
    const storage = createIndexedDbStorage();
    const first = record(createBoard('Primero', '3x3'));
    const second = record(createBoard('Segundo', '3x3'));
    await storage.apply({ put: [first, second] });

    const changed = { ...first, board: toggleCell(first.board, 0) };
    await storage.apply({ put: [changed] });

    const data = loaded(await storage.load());
    expect(data.records).toEqual(expect.arrayContaining([changed, second]));
  });

  test('quitar un tablero lo borra del dispositivo', async () => {
    const storage = createIndexedDbStorage();
    const first = record();
    await storage.apply({ put: [first] });

    await storage.apply({ remove: [first.board.id] });

    expect(loaded(await storage.load()).records).toEqual([]);
  });

  test('un registro de tablero corrupto se aparta como copia y el resto se carga', async () => {
    const storage = createIndexedDbStorage();
    const good = record(createBoard('Bueno', '3x3'));
    await storage.apply({ put: [good] });
    const broken = { board: { id: 'roto', title: 5 }, pending: 'quizá' };
    await writeBoardRecord(broken);

    const result = await storage.load();

    expect(result).toMatchObject({ status: 'loaded', skipped: 1 });
    expect(loaded(result).records).toEqual([good]);
    expect((await storage.unreadableCopies()).map((copy) => copy.raw)).toEqual([
      broken,
    ]);
    expect((await dump('boards')).map(([key]) => key)).toEqual([good.board.id]);
  });

  test('si IndexedDB falla, cargar y guardar rechazan', async () => {
    globalThis.indexedDB = {
      open() {
        throw new Error('IndexedDB no disponible');
      },
    } as unknown as IDBFactory;

    await expect(createIndexedDbStorage().load()).rejects.toThrow();
    await expect(createIndexedDbStorage().apply({})).rejects.toThrow();
  });
});

describe('migración desde un único registro (versiones 1 y 2)', () => {
  test('un registro real de la versión 1 pasa a un registro por tablero', async () => {
    await writeLegacy(structuredClone(storedV1));

    const data = loaded(await createIndexedDbStorage().load());

    expect(data.records).toHaveLength(3);
    expect(data.records.map((item) => item.board.title).sort()).toEqual([
      'Archivado',
      'Primero',
      'Segundo',
    ]);
    expect(data.activeBoardId).toBe(storedV1.collection.activeBoardId);
    const archived = data.records.find((item) => item.archivedAt !== null);
    expect(archived?.archivedAt).toBe('2026-10-05T10:00:00.000Z');
    for (const item of data.records) {
      expect(item).toMatchObject({
        ownerId: null,
        pending: false,
        deletedAt: null,
      });
      expect(item.board.style).not.toHaveProperty('primaryColor');
    }
  });

  test('un registro de la versión 2 también se migra, sin perder fotos', async () => {
    const data = sampleData();
    await writeLegacy(toStoredData(data));

    const loadedData = loaded(await createIndexedDbStorage().load());

    const first = loadedData.records.find(
      (item) => item.board.id === data.collection.boards[0]?.id,
    );
    expect(first?.board).toEqual(data.collection.boards[0]);
    expect(first?.board.cells[0]?.imagePath).toBe(
      'data:image/jpeg;base64,AAAA',
    );
  });

  test('tras migrar, el registro antiguo desaparece y no quedan copias', async () => {
    await writeLegacy(structuredClone(storedV1));

    await createIndexedDbStorage().load();

    expect(await dump('state')).toEqual([]);
    expect(await dump('meta')).toEqual(
      expect.arrayContaining([['version', STORAGE_VERSION]]),
    );
  });

  test('la siguiente carga ya lee la versión 3 y devuelve lo mismo', async () => {
    await writeLegacy(structuredClone(storedV1));
    const first = loaded(await createIndexedDbStorage().load());

    const second = loaded(await createIndexedDbStorage().load());

    expect(second.records).toEqual(expect.arrayContaining([...first.records]));
    expect(second.activeBoardId).toBe(first.activeBoardId);
  });

  test.each([
    ['corrupto', 'esto no son datos'],
    ['de una versión más nueva', { version: 99, tableros: [] }],
  ])('un registro %s se deja intacto y se avisa', async (_, value) => {
    await writeLegacy(value);

    const result = await createIndexedDbStorage().load();

    expect(result).toEqual({ status: 'unreadable' });
    expect(await dump('state')).toEqual([['app', value]]);
  });

  test('al guardar el primer cambio, el registro ilegible pasa a ser una copia', async () => {
    await writeLegacy('esto no son datos');
    const storage = createIndexedDbStorage();
    await storage.load();

    await storage.apply({ put: [record()] });

    const state = await dump('state');
    expect(state).toHaveLength(1);
    expect(String(state[0]?.[0])).toMatch(/^unreadable-\d{4}-\d{2}-\d{2}T/);
    expect(state[0]?.[1]).toBe('esto no son datos');
    expect(await storage.unreadableCopies()).toEqual([
      { key: state[0]?.[0], raw: 'esto no son datos' },
    ]);
    // Y lo nuevo ya se carga con normalidad.
    expect(loaded(await storage.load()).records).toHaveLength(1);
  });

  test('la copia se hace una sola vez', async () => {
    await writeLegacy('esto no son datos');
    const storage = createIndexedDbStorage();

    await storage.apply({ put: [record()] });
    await storage.apply({ put: [record()] });

    expect(await dump('state')).toHaveLength(1);
  });
});

describe('avisos entre pestañas', () => {
  test('lo que guarda una pestaña llega a las demás', async () => {
    const first = createIndexedDbStorage();
    const second = createIndexedDbStorage();
    const received: StorageChanges[] = [];
    const stop = second.subscribe((changes) => received.push(changes));
    const item = record();

    await first.apply({ put: [item], remove: ['otro'] });
    await new Promise((resolve) => setTimeout(resolve, 20));
    stop();

    expect(received).toEqual([{ put: [item], remove: ['otro'] }]);
  });

  test('una pestaña no recibe sus propios avisos', async () => {
    const storage = createIndexedDbStorage();
    const received: StorageChanges[] = [];
    const stop = storage.subscribe((changes) => received.push(changes));

    await storage.apply({ put: [record()] });
    await new Promise((resolve) => setTimeout(resolve, 20));
    stop();

    expect(received).toEqual([]);
  });
});
