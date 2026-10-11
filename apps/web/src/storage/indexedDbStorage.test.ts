// @vitest-environment node
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, test } from 'vitest';
import { activeBoard, toggleCell, replaceBoard } from '@bingogoals/domain';
import { createIndexedDbStorage } from './indexedDbStorage';
import { STORAGE_VERSION } from './schema';
import { EMPTY_DATA, type AppData, type BoardStorage } from './storage';
import { sampleData } from './testData';

/** Carga los datos y falla si no había o no se pudieron leer. */
async function loadedData(storage: BoardStorage): Promise<AppData> {
  const result = await storage.load();
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
      transaction.oncomplete = () => {
        database.close();
        resolve(request.result);
      };
      transaction.onerror = () => reject(transaction.error);
    };
  });
}

/** Todos los registros del almacén, como pares [clave, valor]. */
function allRecords(): Promise<[IDBValidKey, unknown][]> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('bingogoals', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('state');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const store = database.transaction('state').objectStore('state');
      const keys = store.getAllKeys();
      const values = store.getAll();
      values.onsuccess = () => {
        database.close();
        resolve(keys.result.map((key, index) => [key, values.result[index]]));
      };
    };
  });
}

beforeEach(() => {
  // Cada test empieza con una base de datos vacía.
  globalThis.indexedDB = new IDBFactory();
});

describe('almacenamiento en IndexedDB', () => {
  test('sin nada guardado, cargar dice que no hay datos', async () => {
    expect(await createIndexedDbStorage().load()).toEqual({
      status: 'empty',
    });
  });

  test('carga lo que se guardó: tableros, activo, historial y casillas', async () => {
    const data = sampleData();

    await createIndexedDbStorage().save(data);
    // Otra instancia, como al volver a abrir la web.
    const loaded = await loadedData(createIndexedDbStorage());

    expect(loaded).toEqual(data);
    expect(loaded?.collection.activeBoardId).toBe(
      data.collection.activeBoardId,
    );
    expect(loaded?.collection.boards[0]?.cells[0]).toEqual({
      ...data.collection.boards[0]?.cells[0],
      text: 'Correr 10 km',
      icon: '🏋️',
      color: '#2196F3',
      imagePath: 'data:image/jpeg;base64,AAAA',
      isCompleted: true,
    });
    expect(loaded?.collection.boards[0]?.style.theme).toBe('sakura');
    expect(loaded?.history[0]?.archivedAt).toBe('2026-10-05T10:00:00.000Z');
  });

  test('los datos guardados llevan número de versión', async () => {
    await createIndexedDbStorage().save(sampleData());

    expect(await rawRecord()).toMatchObject({ version: STORAGE_VERSION });
  });

  test('guardar de nuevo sustituye lo anterior', async () => {
    const storage = createIndexedDbStorage();
    const data = sampleData();
    await storage.save(data);

    const board = activeBoard(data.collection)!;
    const changed = {
      ...data,
      collection: replaceBoard(data.collection, toggleCell(board, 0)),
    };
    await storage.save(changed);

    expect(await storage.load()).toEqual({ status: 'loaded', data: changed });
  });

  test('guarda y carga unos datos vacíos', async () => {
    const storage = createIndexedDbStorage();
    await storage.save(sampleData());

    await storage.save(EMPTY_DATA);

    expect(await storage.load()).toEqual({
      status: 'loaded',
      data: EMPTY_DATA,
    });
  });

  test('guarda fotos grandes sin perder nada', async () => {
    const storage = createIndexedDbStorage();
    const data = sampleData();
    const photo = `data:image/jpeg;base64,${'A'.repeat(2_000_000)}`;
    const board = activeBoard(data.collection)!;
    const withPhoto = {
      ...data,
      collection: replaceBoard(data.collection, {
        ...board,
        cells: board.cells.with(0, { ...board.cells[0]!, imagePath: photo }),
      }),
    };

    await storage.save(withPhoto);

    const loaded = await loadedData(storage);
    expect(activeBoard(loaded!.collection)?.cells[0]?.imagePath).toBe(photo);
  });

  test.each([
    ['un texto', 'esto no son datos'],
    ['un objeto sin forma', { version: STORAGE_VERSION, cosas: true }],
    [
      'tableros corruptos',
      {
        version: STORAGE_VERSION,
        collection: { boards: [{ id: 1 }], activeBoardId: null },
        history: [],
      },
    ],
  ])('con datos corruptos (%s), cargar lo indica', async (_, value) => {
    await rawRecord({ value });

    expect(await createIndexedDbStorage().load()).toEqual({
      status: 'unreadable',
    });
  });

  test('con una versión desconocida, cargar lo indica', async () => {
    await rawRecord({ value: { ...sampleData(), version: 3 } });

    expect(await createIndexedDbStorage().load()).toEqual({
      status: 'unreadable',
    });
  });

  test('tras cargar datos corruptos se puede volver a guardar', async () => {
    await rawRecord({ value: 'corrupto' });
    const storage = createIndexedDbStorage();
    await storage.load();

    const data = sampleData();
    await storage.save(data);

    expect(await storage.load()).toEqual({ status: 'loaded', data: data });
  });

  test('si IndexedDB falla, guardar y cargar rechazan', async () => {
    globalThis.indexedDB = {
      open() {
        throw new Error('IndexedDB no disponible');
      },
    } as unknown as IDBFactory;

    await expect(createIndexedDbStorage().load()).rejects.toThrow();
    await expect(createIndexedDbStorage().save(EMPTY_DATA)).rejects.toThrow();
  });

  // Hallazgo 1 de la revisión de la fase 1.
  describe('registro ilegible', () => {
    test.each([
      ['corrupto', 'esto no son datos'],
      ['de una versión más nueva', { version: 3, tableros: ['uno', 'dos'] }],
    ])('guardar sobre un registro %s conserva una copia', async (_, value) => {
      await rawRecord({ value });
      const storage = createIndexedDbStorage();
      await storage.load();

      const data = sampleData();
      await storage.save(data);

      const others = (await allRecords()).filter(([key]) => key !== 'app');
      expect(others.map(([, copy]) => copy)).toEqual([value]);
      expect(String(others[0]?.[0])).toMatch(/^unreadable-\d{4}-\d{2}-\d{2}T/);
      // Y lo nuevo queda guardado con normalidad.
      expect(await storage.load()).toEqual({ status: 'loaded', data });
    });

    test('la copia se hace una sola vez, no en cada guardado', async () => {
      await rawRecord({ value: 'esto no son datos' });
      const storage = createIndexedDbStorage();

      await storage.save(sampleData());
      await storage.save(sampleData());
      await storage.save(sampleData());

      expect(await allRecords()).toHaveLength(2);
    });

    test('cargar un registro ilegible no lo modifica ni lo borra', async () => {
      await rawRecord({ value: 'esto no son datos' });

      await createIndexedDbStorage().load();
      await createIndexedDbStorage().load();

      expect(await allRecords()).toEqual([['app', 'esto no son datos']]);
    });

    test('guardar sobre un registro válido no deja copias', async () => {
      const storage = createIndexedDbStorage();
      await storage.save(sampleData());
      await storage.save(sampleData());

      expect((await allRecords()).map(([key]) => key)).toEqual(['app']);
    });
  });
});
