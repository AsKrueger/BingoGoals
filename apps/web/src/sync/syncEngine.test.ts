// @vitest-environment node
import {
  activeBoard,
  addBoard,
  createBoard,
  removeBoard,
  renameBoard,
  replaceBoard,
  toggleCell,
  updateCell,
  type BingoBoard,
} from '@bingogoals/domain';
import { describe, expect, test, vi } from 'vitest';
import { createFakeAccountApi, type FakeAccountApi } from '../account/fakeApi';
import {
  createMemoryStorage,
  type MemoryStorage,
} from '../storage/memoryStorage';
import { EMPTY_LOCAL_DATA } from '../storage/storage';
import { createBoardStore, type BoardStore } from '../store/boardStore';
import { createPhotoStore, type PhotoStore } from '../store/photoStore';
import { createFakeBoardsApi, type FakeBoardsApi } from './fakeBoardsApi';
import { createSyncEngine, type SyncEngine } from './syncEngine';

/** Temporizadores que solo avanzan cuando el test lo pide. */
function manualTimers() {
  let next = 1;
  const timeouts = new Map<number, { callback: () => void; ms: number }>();
  const intervals = new Map<number, () => void>();
  return {
    timers: {
      setTimeout(callback: () => void, ms: number) {
        const id = next++;
        timeouts.set(id, { callback, ms });
        return id;
      },
      clearTimeout(handle: unknown) {
        timeouts.delete(handle as number);
      },
      setInterval(callback: () => void) {
        const id = next++;
        intervals.set(id, callback);
        return id;
      },
      clearInterval(handle: unknown) {
        intervals.delete(handle as number);
      },
    },
    /** Esperas programadas ahora mismo, en milisegundos. */
    pending: () => [...timeouts.values()].map((timeout) => timeout.ms),
    /** Ejecuta las esperas programadas. */
    runTimeouts() {
      const due = [...timeouts.values()];
      timeouts.clear();
      for (const { callback } of due) {
        callback();
      }
    },
    tickIntervals() {
      for (const callback of intervals.values()) {
        callback();
      }
    },
  };
}

/** Deja que terminen las promesas pendientes. */
const settle = async () => {
  for (let round = 0; round < 5; round++) {
    await new Promise((resolve) => setTimeout(resolve));
  }
};

interface Server {
  accounts: FakeAccountApi;
  boards: FakeBoardsApi;
}

function server(): Server {
  const accounts = createFakeAccountApi();
  return { accounts, boards: createFakeBoardsApi(accounts) };
}

interface Device {
  store: BoardStore;
  engine: SyncEngine;
  clock: ReturnType<typeof manualTimers>;
  onUnauthorized: ReturnType<typeof vi.fn>;
  online: { value: boolean };
}

/** Un dispositivo con la sesión de `token` iniciada. */
function device(
  { boards }: Server,
  userId: string,
  token: string,
  store = createBoardStore(createMemoryStorage(), EMPTY_LOCAL_DATA),
): Device {
  const clock = manualTimers();
  const onUnauthorized = vi.fn();
  const online = { value: true };
  store.setViewer(userId);
  const engine = createSyncEngine({
    store,
    api: boards,
    userId,
    getToken: () => token,
    onUnauthorized,
    isOnline: () => online.value,
    timers: clock.timers,
  });
  return { store, engine, clock, onUnauthorized, online };
}

async function account(
  { accounts }: Server,
  email = 'ana@example.com',
): Promise<{ userId: string; token: string }> {
  const session = await accounts
    .register(email, 'correcta-caballo')
    .catch(() => accounts.login(email, 'correcta-caballo'));
  return { userId: session.user.id, token: session.token };
}

function create(store: BoardStore, title: string, at?: Date): BingoBoard {
  const board = createBoard(title, '3x3', at);
  store.update((data) => ({
    ...data,
    collection: addBoard(data.collection, board),
  }));
  return board;
}

function change(store: BoardStore, board: BingoBoard) {
  store.update((data) => ({
    ...data,
    collection: replaceBoard(data.collection, board),
  }));
}

function titles(store: BoardStore) {
  return store
    .getSnapshot()
    .data.collection.boards.map((board) => board.title)
    .sort();
}

describe('subir y descargar', () => {
  test('un tablero creado en A llega al servidor y aparece en B', async () => {
    const api = server();
    const { userId, token } = await account(api);
    const a = device(api, userId, token);
    const b = device(api, userId, token);

    create(a.store, 'Metas');
    await a.engine.syncNow();
    await b.engine.syncNow();

    expect(
      api.boards.stored(userId).map((record) => record.board.title),
    ).toEqual(['Metas']);
    expect(titles(b.store)).toEqual(['Metas']);
    expect(a.engine.getStatus()).toBe('synced');
    expect(a.store.pendingFor(userId)).toEqual([]);
  });

  test('una casilla marcada en B aparece marcada en A', async () => {
    const api = server();
    const { userId, token } = await account(api);
    const a = device(api, userId, token);
    const b = device(api, userId, token);
    const board = create(a.store, 'Metas', new Date('2026-10-20T10:00:00Z'));
    await a.engine.syncNow();
    await b.engine.syncNow();

    change(b.store, toggleCell(board, 0, new Date('2026-10-20T11:00:00Z')));
    await b.engine.syncNow();
    await a.engine.syncNow();

    expect(
      activeBoard(a.store.getSnapshot().data.collection)?.cells[0]?.isCompleted,
    ).toBe(true);
  });

  test('borrar en A se refleja en B', async () => {
    const api = server();
    const { userId, token } = await account(api);
    const a = device(api, userId, token);
    const b = device(api, userId, token);
    const board = create(a.store, 'Metas', new Date('2026-10-20T10:00:00Z'));
    await a.engine.syncNow();
    await b.engine.syncNow();

    a.store.update((data) => ({
      ...data,
      collection: removeBoard(data.collection, board.id),
    }));
    await a.engine.syncNow();
    await b.engine.syncNow();

    expect(titles(b.store)).toEqual([]);
    expect(api.boards.stored(userId)[0]?.deletedAt).not.toBeNull();
    // Una vez en el servidor, el borrado ya no hace falta en A.
    expect(a.store.pendingFor(userId)).toEqual([]);
  });

  test('solo se piden los cambios desde la última vez', async () => {
    const api = server();
    const { userId, token } = await account(api);
    const a = device(api, userId, token);
    create(a.store, 'Uno');
    await a.engine.syncNow();
    const b = device(api, userId, token);
    await b.engine.syncNow();

    const list = vi.spyOn(api.boards, 'list');
    await b.engine.syncNow();

    expect(list).toHaveBeenCalledWith(token, b.store.cursorFor(userId));
    expect(b.store.cursorFor(userId)).not.toBeNull();
  });
});

describe('conflictos', () => {
  test('el mismo tablero cambiado en A y B sin conexión: gana el último cambio', async () => {
    const api = server();
    const { userId, token } = await account(api);
    const a = device(api, userId, token);
    const b = device(api, userId, token);
    const board = create(a.store, 'Metas', new Date('2026-10-20T10:00:00Z'));
    await a.engine.syncNow();
    await b.engine.syncNow();

    // Los dos cambian sin conexión; B lo hace más tarde.
    change(
      a.store,
      renameBoard(board, 'De A', new Date('2026-10-21T10:00:00Z')),
    );
    change(
      b.store,
      renameBoard(board, 'De B', new Date('2026-10-21T11:00:00Z')),
    );
    // Primero reconecta B y después A.
    await b.engine.syncNow();
    await a.engine.syncNow();
    await b.engine.syncNow();

    expect(titles(a.store)).toEqual(['De B']);
    expect(titles(b.store)).toEqual(['De B']);
    expect(api.boards.stored(userId)).toHaveLength(1);
    expect(a.store.pendingFor(userId)).toEqual([]);
  });

  test('si el cambio más antiguo llega después, el servidor lo rechaza y gana el suyo', async () => {
    const api = server();
    const { userId, token } = await account(api);
    const a = device(api, userId, token);
    const b = device(api, userId, token);
    const board = create(a.store, 'Metas', new Date('2026-10-20T10:00:00Z'));
    await a.engine.syncNow();
    await b.engine.syncNow();

    change(
      b.store,
      renameBoard(board, 'De B', new Date('2026-10-21T11:00:00Z')),
    );
    await b.engine.syncNow();
    change(
      a.store,
      renameBoard(board, 'De A', new Date('2026-10-21T10:00:00Z')),
    );
    await a.engine.syncNow();

    expect(titles(a.store)).toEqual(['De B']);
    expect(api.boards.calls.put).toBeGreaterThan(1);
  });
});

describe('cuentas', () => {
  test('los tableros creados sin cuenta se suben al iniciar sesión', async () => {
    const api = server();
    const store = createBoardStore(createMemoryStorage(), EMPTY_LOCAL_DATA);
    create(store, 'Antes de la cuenta');
    const { userId, token } = await account(api);

    const a = device(api, userId, token, store);
    await a.engine.syncNow();

    expect(
      api.boards.stored(userId).map((record) => record.board.title),
    ).toEqual(['Antes de la cuenta']);
  });

  test('otra cuenta no ve ni recibe los tableros de la primera', async () => {
    const api = server();
    const ana = await account(api, 'ana@example.com');
    const luis = await account(api, 'luis@example.com');
    const store = createBoardStore(createMemoryStorage(), EMPTY_LOCAL_DATA);
    const anaDevice = device(api, ana.userId, ana.token, store);
    create(store, 'De Ana');
    await anaDevice.engine.syncNow();
    anaDevice.engine.stop();

    // Luis inicia sesión en el mismo dispositivo.
    const luisDevice = device(api, luis.userId, luis.token, store);
    await luisDevice.engine.syncNow();

    expect(titles(store)).toEqual([]);
    expect(api.boards.stored(luis.userId)).toEqual([]);
  });
});

describe('sin conexión y reintentos', () => {
  test('sin conexión los cambios quedan pendientes y se avisa', async () => {
    const api = server();
    const { userId, token } = await account(api);
    const a = device(api, userId, token);
    a.engine.start();
    await settle();
    api.accounts.isDown = true;
    a.online.value = false;

    create(a.store, 'Metas');
    a.clock.runTimeouts();
    await settle();

    expect(a.engine.getStatus()).toBe('offline');
    expect(a.store.pendingFor(userId)).toHaveLength(1);
    a.engine.stop();
  });

  test('con conexión pero sin respuesta del servidor, espera y reintenta cada vez más tarde', async () => {
    const api = server();
    const { userId, token } = await account(api);
    const a = device(api, userId, token);
    a.engine.start();
    await settle();
    api.accounts.isDown = true;

    await a.engine.syncNow();
    expect(a.engine.getStatus()).toBe('waiting');
    expect(a.clock.pending()).toEqual([2_000]);

    a.clock.runTimeouts();
    await settle();
    expect(a.clock.pending()).toEqual([5_000]);

    // El servidor despierta: el siguiente reintento lo sube todo.
    api.accounts.isDown = false;
    create(a.store, 'Metas');
    a.clock.runTimeouts();
    await settle();
    a.clock.runTimeouts();
    await settle();

    expect(a.engine.getStatus()).toBe('synced');
    expect(api.boards.stored(userId)).toHaveLength(1);
    a.engine.stop();
  });

  test('un cambio local se sube tras una breve espera', async () => {
    const api = server();
    const { userId, token } = await account(api);
    const a = device(api, userId, token);
    a.engine.start();
    await settle();

    create(a.store, 'Metas');
    expect(a.engine.getStatus()).toBe('pending');
    expect(api.boards.stored(userId)).toEqual([]);

    a.clock.runTimeouts();
    await settle();

    expect(api.boards.stored(userId)).toHaveLength(1);
    expect(a.engine.getStatus()).toBe('synced');
    a.engine.stop();
  });

  test('también consulta cambios cada cierto tiempo', async () => {
    const api = server();
    const { userId, token } = await account(api);
    const a = device(api, userId, token);
    const b = device(api, userId, token);
    b.engine.start();
    await settle();

    create(a.store, 'Metas');
    await a.engine.syncNow();
    b.clock.tickIntervals();
    await settle();

    expect(titles(b.store)).toEqual(['Metas']);
    b.engine.stop();
  });

  test('si la sesión ya no vale, avisa y se detiene', async () => {
    const api = server();
    const { userId, token } = await account(api);
    const a = device(api, userId, token);
    api.accounts.expire(token);

    await a.engine.syncNow();

    expect(a.onUnauthorized).toHaveBeenCalledOnce();
    expect(a.engine.getStatus()).toBe('error');
  });
});

describe('fotos', () => {
  const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
  const T1 = new Date('2026-10-20T10:00:00Z');
  const T2 = new Date('2026-10-20T11:00:00Z');

  interface PhotoDevice extends Device {
    photos: PhotoStore;
    storage: MemoryStorage;
  }

  /** Un dispositivo que también sincroniza las fotos. */
  function photoDevice(
    { boards }: Server,
    userId: string,
    token: string,
  ): PhotoDevice {
    const storage = createMemoryStorage();
    const store = createBoardStore(storage, EMPTY_LOCAL_DATA);
    const photos = createPhotoStore(storage.photos, { toUrl: (p) => p.id });
    const clock = manualTimers();
    store.setViewer(userId);
    const engine = createSyncEngine({
      store,
      photos,
      api: boards,
      userId,
      getToken: () => token,
      timers: clock.timers,
    });
    return {
      store,
      engine,
      clock,
      onUnauthorized: vi.fn(),
      online: { value: true },
      photos,
      storage,
    };
  }

  /** Crea un tablero con una foto nueva en la primera casilla. */
  async function withPhoto(device: PhotoDevice, title = 'Metas') {
    const photoId = await device.photos.add({
      type: 'image/jpeg',
      bytes: JPEG.slice().buffer,
    });
    const board = updateCell(
      create(device.store, title, T1),
      0,
      { photoId },
      T1,
    );
    change(device.store, board);
    return { board, photoId };
  }

  test('la foto de un tablero llega al servidor y al otro dispositivo', async () => {
    const api = server();
    const { userId, token } = await account(api);
    const a = photoDevice(api, userId, token);
    const b = photoDevice(api, userId, token);
    const { photoId } = await withPhoto(a);

    await a.engine.syncNow();
    await b.engine.syncNow();

    expect(api.boards.photos(userId).has(photoId)).toBe(true);
    const received = await b.photos.get(photoId);
    expect(new Uint8Array(received!.bytes)).toEqual(JPEG);
    expect(received?.uploadedBy).toBe(userId);
    expect(b.photos.url(photoId)).toBe(photoId);
  });

  test('la foto se sube antes que el tablero', async () => {
    const api = server();
    const { userId, token } = await account(api);
    const a = photoDevice(api, userId, token);
    const order: string[] = [];
    const putPhoto = api.boards.putPhoto;
    const put = api.boards.put;
    api.boards.putPhoto = (...args) => {
      order.push('foto');
      return putPhoto(...args);
    };
    api.boards.put = (...args) => {
      order.push('tablero');
      return put(...args);
    };
    await withPhoto(a);

    await a.engine.syncNow();

    expect(order).toEqual(['foto', 'tablero']);
  });

  test('una foto ya subida no se vuelve a subir al cambiar el tablero', async () => {
    const api = server();
    const { userId, token } = await account(api);
    const a = photoDevice(api, userId, token);
    const { board, photoId } = await withPhoto(a);
    await a.engine.syncNow();

    change(a.store, toggleCell(board, 1, T2));
    await a.engine.syncNow();

    expect(api.boards.calls.putPhoto).toBe(1);
    expect((await a.photos.get(photoId))?.uploadedBy).toBe(userId);
  });

  test('si el servidor ya no tiene una foto subida, se vuelve a subir', async () => {
    const api = server();
    const { userId, token } = await account(api);
    const a = photoDevice(api, userId, token);
    const { board, photoId } = await withPhoto(a);
    await a.engine.syncNow();
    api.boards.photos(userId).delete(photoId);

    change(a.store, toggleCell(board, 1, T2));
    await a.engine.syncNow();

    expect(api.boards.photos(userId).has(photoId)).toBe(true);
  });

  test('una foto que el servidor no tiene se deja de pedir y la casilla queda sin ella', async () => {
    const api = server();
    const { userId, token } = await account(api);
    const a = photoDevice(api, userId, token);
    const b = photoDevice(api, userId, token);
    const { photoId } = await withPhoto(a);
    await a.photos.markUploaded(photoId, userId); // Como si ya estuviera subida.
    await a.engine.syncNow();
    api.boards.photos(userId).clear();

    await b.engine.syncNow();
    await b.engine.syncNow();

    expect(api.boards.calls.getPhoto).toBe(1);
    expect(await b.photos.get(photoId)).toBeUndefined();
    expect(b.engine.getStatus()).toBe('synced');
  });

  test('una foto que el servidor rechaza no impide subir el tablero', async () => {
    const api = server();
    const { userId, token } = await account(api);
    const a = photoDevice(api, userId, token);
    const photoId = await a.photos.add({
      type: 'image/jpeg',
      bytes: new TextEncoder().encode('no es una foto').buffer,
    });
    change(a.store, updateCell(create(a.store, 'Metas'), 0, { photoId }));

    await a.engine.syncNow();

    expect(api.boards.stored(userId)).toHaveLength(1);
    expect(a.engine.getStatus()).toBe('synced');
  });

  test('sin conexión, la foto queda pendiente y se sube al reconectar', async () => {
    const api = server();
    const { userId, token } = await account(api);
    const a = photoDevice(api, userId, token);
    const { photoId } = await withPhoto(a);
    api.accounts.isDown = true;

    await a.engine.syncNow();
    expect(a.engine.getStatus()).not.toBe('synced');
    api.accounts.isDown = false;
    await a.engine.syncNow();

    expect(api.boards.photos(userId).has(photoId)).toBe(true);
    expect(a.engine.getStatus()).toBe('synced');
  });

  test('cambiar la foto en A: B recibe la nueva y el servidor borra la anterior', async () => {
    const api = server();
    const { userId, token } = await account(api);
    const a = photoDevice(api, userId, token);
    const b = photoDevice(api, userId, token);
    const { board } = await withPhoto(a);
    await a.engine.syncNow();
    await b.engine.syncNow();

    const second = await a.photos.add({
      type: 'image/jpeg',
      bytes: JPEG.slice().buffer,
    });
    change(a.store, updateCell(board, 0, { photoId: second }, T2));
    await a.engine.syncNow();
    await b.engine.syncNow();

    expect([...api.boards.photos(userId).keys()]).toEqual([second]);
    expect(b.photos.url(second)).toBe(second);
    expect(
      b.store.getSnapshot().data.collection.boards[0]?.cells[0]?.photoId,
    ).toBe(second);
  });
});
