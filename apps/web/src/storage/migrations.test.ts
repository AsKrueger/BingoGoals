// @vitest-environment node
import 'fake-indexeddb/auto';
import { isBingoBoard } from '@bingogoals/domain';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, test } from 'vitest';
import storedV1 from './fixtures/stored-v1.json';
import { createIndexedDbStorage } from './indexedDbStorage';
import { createMemoryStorage } from './memoryStorage';
import { migrateStoredData } from './migrations';
import { readStoredData, STORAGE_VERSION } from './schema';
import type { AppData } from './storage';

// fixtures/stored-v1.json es un registro real de la versión 1: lo generó el
// código de la fase 1 (commit 3a78468) con dos tableros y uno archivado.

/** Copia del registro de la versión 1, para que ningún test altere el original. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function v1(): any {
  return structuredClone(storedV1);
}

function loaded(raw: unknown): AppData {
  const result = readStoredData(raw);
  if (result.status !== 'loaded') {
    throw new Error(`Se esperaban datos y la carga dio «${result.status}».`);
  }
  return result.data;
}

/** Lee o escribe el registro guardado sin pasar por la capa de almacenamiento. */
function rawRecord(write?: { value: unknown }): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('bingogoals', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('state');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const transaction = database.transaction('state', 'readwrite');
      const store = transaction.objectStore('state');
      const request = write ? store.put(write.value, 'app') : store.get('app');
      const keys = store.getAllKeys();
      transaction.oncomplete = () => {
        database.close();
        resolve(
          write ? undefined : { record: request.result, keys: keys.result },
        );
      };
    };
  });
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe('el registro de la versión 1', () => {
  test('tiene el formato antiguo', () => {
    const board = v1().collection.boards[0];

    expect(v1().version).toBe(1);
    expect(board.style).toEqual({
      theme: 'sakura',
      primaryColor: '#6200EE',
      fontFamily: 'Poppins',
    });
    expect(board).not.toHaveProperty('updatedAt');
  });
});

describe('migración de la versión 1 a la 2', () => {
  test('un registro de la versión 1 deja de ser ilegible', () => {
    expect(readStoredData(v1()).status).toBe('loaded');
  });

  test('el registro migrado lleva la versión actual', () => {
    expect(migrateStoredData(v1())).toMatchObject({
      version: STORAGE_VERSION,
    });
  });

  test('no se pierde ningún tablero ni el tablero activo', () => {
    const data = loaded(v1());

    expect(data.collection.boards.map((board) => board.title)).toEqual([
      'Primero',
      'Segundo',
    ]);
    expect(data.collection.boards.map((board) => board.id)).toEqual(
      v1().collection.boards.map((board: { id: string }) => board.id),
    );
    expect(data.collection.activeBoardId).toBe(v1().collection.activeBoardId);
  });

  test('las casillas quedan idénticas: texto, icono, color, foto y estado', () => {
    const data = loaded(v1());

    data.collection.boards.forEach((board, index) => {
      expect(board.cells).toEqual(v1().collection.boards[index].cells);
    });
    expect(data.collection.boards[0]?.cells[0]).toMatchObject({
      text: 'Correr 10 km',
      icon: '🏋️',
      color: '#2196F3',
      imagePath: 'data:image/jpeg;base64,AAAA',
      isCompleted: true,
    });
    expect(data.collection.boards[1]?.cells[12]).toMatchObject({
      isCentralStar: true,
      isCompleted: true,
    });
  });

  test('no se pierde el historial ni su fecha de archivo', () => {
    const data = loaded(v1());

    expect(data.history).toHaveLength(1);
    expect(data.history[0]?.archivedAt).toBe('2026-10-05T10:00:00.000Z');
    expect(data.history[0]?.board.title).toBe('Archivado');
    expect(data.history[0]?.board.cells).toEqual(v1().history[0].board.cells);
  });

  test('el estilo conserva el tema y pierde los dos campos sin uso', () => {
    const data = loaded(v1());

    expect(data.collection.boards[0]?.style).toEqual({ theme: 'sakura' });
    expect(data.collection.boards[1]?.style).toEqual({ theme: 'classic' });
    expect(data.history[0]?.board.style).toEqual({ theme: 'classic' });
    expect(JSON.stringify(data)).not.toMatch(/primaryColor|fontFamily/);
  });

  test('updatedAt empieza igual que createdAt, también en los archivados', () => {
    const data = loaded(v1());
    const boards = [
      ...data.collection.boards,
      ...data.history.map((entry) => entry.board),
    ];

    expect(boards).toHaveLength(3);
    for (const board of boards) {
      expect(board.updatedAt).toBe(board.createdAt);
      expect(isBingoBoard(board)).toBe(true);
    }
    expect(data.collection.boards[0]?.createdAt).toBe(
      v1().collection.boards[0].createdAt,
    );
  });

  test('no modifica el registro recibido', () => {
    const raw = v1();

    migrateStoredData(raw);

    expect(raw).toEqual(storedV1);
  });

  test('un registro que ya es de la versión actual no cambia', () => {
    const current = migrateStoredData(v1());

    expect(migrateStoredData(current)).toBe(current);
  });

  test.each([
    ['sin colección', (raw: ReturnType<typeof v1>) => delete raw.collection],
    [
      'con el historial roto',
      (raw: ReturnType<typeof v1>) => (raw.history = 7),
    ],
    [
      'con un tablero que no es un objeto',
      (raw: ReturnType<typeof v1>) => (raw.collection.boards[0] = 'tablero'),
    ],
    [
      'con un tablero sin fecha de creación',
      (raw: ReturnType<typeof v1>) => delete raw.collection.boards[0].createdAt,
    ],
    [
      'con un tablero sin estilo',
      (raw: ReturnType<typeof v1>) => delete raw.collection.boards[0].style,
    ],
  ])('un registro de la versión 1 %s sigue siendo ilegible', (_, corrupt) => {
    const raw = v1();
    corrupt(raw);

    expect(() => migrateStoredData(raw)).not.toThrow();
    expect(readStoredData(raw).status).toBe('unreadable');
  });

  test.each([
    undefined,
    null,
    'texto',
    42,
    [],
    {},
    { version: 0 },
    { version: 3 },
  ])(
    'lo que no es un registro de la versión 1 (%s) se devuelve tal cual',
    (raw) => {
      expect(migrateStoredData(raw)).toBe(raw);
    },
  );
});

describe('migración al abrir la web', () => {
  test('IndexedDB: cargar un registro de la versión 1 lo deja guardado en la 2', async () => {
    await rawRecord({ value: v1() });

    const result = await createIndexedDbStorage().load();

    expect(result.status).toBe('loaded');
    const { record, keys } = (await rawRecord()) as {
      record: { version: number; collection: AppData['collection'] };
      keys: string[];
    };
    expect(record.version).toBe(2);
    expect(record.collection.boards[0]?.style).toEqual({ theme: 'sakura' });
    expect(record.collection.boards[0]).toHaveProperty('updatedAt');
    // No es un registro ilegible: no se hace copia.
    expect(keys).toEqual(['app']);
  });

  test('IndexedDB: tras migrar, la siguiente carga devuelve lo mismo', async () => {
    await rawRecord({ value: v1() });
    const first = await createIndexedDbStorage().load();

    const second = await createIndexedDbStorage().load();

    expect(second).toEqual(first);
  });

  test('IndexedDB: un registro de la versión 1 corrupto no se toca', async () => {
    const raw = v1();
    raw.collection.boards[0].cells.pop();
    await rawRecord({ value: raw });

    const result = await createIndexedDbStorage().load();

    expect(result.status).toBe('unreadable');
    expect(((await rawRecord()) as { record: unknown }).record).toEqual(raw);
  });

  test('si no se puede guardar la migración, los datos se cargan igual', async () => {
    const storage = createMemoryStorage(v1());
    storage.failOnSave = true;

    const result = await storage.load();

    expect(result.status).toBe('loaded');
    expect(storage.raw).toEqual(storedV1);
  });
});
