// @vitest-environment node
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, test } from 'vitest';
import { activeBoard, toggleCell, replaceBoard } from '../domain';
import { createIndexedDbStorage } from './indexedDbStorage';
import { STORAGE_VERSION } from './schema';
import { EMPTY_DATA } from './storage';
import { sampleData } from './testData';

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

beforeEach(() => {
  // Cada test empieza con una base de datos vacía.
  globalThis.indexedDB = new IDBFactory();
});

describe('almacenamiento en IndexedDB', () => {
  test('sin nada guardado, cargar devuelve null', async () => {
    expect(await createIndexedDbStorage().load()).toBeNull();
  });

  test('carga lo que se guardó: tableros, activo, historial y casillas', async () => {
    const data = sampleData();

    await createIndexedDbStorage().save(data);
    // Otra instancia, como al volver a abrir la web.
    const loaded = await createIndexedDbStorage().load();

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

    expect(await storage.load()).toEqual(changed);
  });

  test('guarda y carga unos datos vacíos', async () => {
    const storage = createIndexedDbStorage();
    await storage.save(sampleData());

    await storage.save(EMPTY_DATA);

    expect(await storage.load()).toEqual(EMPTY_DATA);
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

    const loaded = await storage.load();
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
  ])('con datos corruptos (%s), cargar devuelve null', async (_, value) => {
    await rawRecord({ value });

    expect(await createIndexedDbStorage().load()).toBeNull();
  });

  test('con una versión desconocida, cargar devuelve null', async () => {
    await rawRecord({ value: { ...sampleData(), version: 2 } });

    expect(await createIndexedDbStorage().load()).toBeNull();
  });

  test('tras cargar datos corruptos se puede volver a guardar', async () => {
    await rawRecord({ value: 'corrupto' });
    const storage = createIndexedDbStorage();
    await storage.load();

    const data = sampleData();
    await storage.save(data);

    expect(await storage.load()).toEqual(data);
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
});
