// @vitest-environment node
import {
  activeBoard,
  addBoard,
  archiveBoard,
  createBoard,
  removeBoard,
  renameBoard,
  replaceBoard,
  toggleCell,
  type BingoBoard,
} from '@bingogoals/domain';
import { describe, expect, test } from 'vitest';
import {
  createMemoryStorage,
  type MemoryStorage,
} from '../storage/memoryStorage';
import {
  EMPTY_LOCAL_DATA,
  type LocalData,
  type LocalRecord,
} from '../storage/storage';
import { createBoardStore, type BoardStore } from './boardStore';

const NOW = new Date('2026-10-27T12:00:00.000Z');
const T1 = new Date('2026-10-20T10:00:00.000Z');
const T2 = new Date('2026-10-21T10:00:00.000Z');
const T3 = new Date('2026-10-22T10:00:00.000Z');

/** Deja que termine la cola de guardado. */
const settle = () => new Promise((resolve) => setTimeout(resolve));

function setup(initial: LocalData = EMPTY_LOCAL_DATA) {
  const storage = createMemoryStorage();
  const store = createBoardStore(storage, initial, { now: () => NOW });
  return { storage, store };
}

function stored(storage: MemoryStorage, id: string) {
  return storage.records.get(id) as LocalRecord | undefined;
}

function create(store: BoardStore, title: string, at = T1): BingoBoard {
  const board = createBoard(title, '3x3', at);
  store.update((data) => ({
    ...data,
    collection: addBoard(data.collection, board),
  }));
  return board;
}

function local(
  board: BingoBoard,
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

describe('cambios del usuario', () => {
  test('crear un tablero lo guarda como registro propio, pendiente y activo', async () => {
    const { storage, store } = setup();

    const board = create(store, 'Metas');
    await settle();

    expect(store.getSnapshot().data.collection).toEqual({
      boards: [board],
      activeBoardId: board.id,
    });
    expect(stored(storage, board.id)).toEqual(local(board, { pending: true }));
    expect(storage.activeBoardId()).toBe(board.id);
  });

  test('cambiar un tablero solo guarda ese tablero', async () => {
    const { storage, store } = setup();
    const first = create(store, 'Primero');
    const second = create(store, 'Segundo');
    await settle();
    const before = stored(storage, first.id);

    store.update((data) => ({
      ...data,
      collection: replaceBoard(data.collection, toggleCell(second, 0, T2)),
    }));
    await settle();

    expect(stored(storage, first.id)).toBe(before);
    expect(stored(storage, second.id)?.board.updatedAt).toBe(T2.toISOString());
  });

  test('archivar cuenta como versión nueva aunque el tablero no cambie', async () => {
    const { storage, store } = setup();
    const board = create(store, 'Metas');

    store.update((data) => ({
      collection: removeBoard(data.collection, board.id),
      history: archiveBoard(data.history, board, T3),
    }));
    await settle();

    expect(stored(storage, board.id)).toMatchObject({
      archivedAt: T3.toISOString(),
      board: { updatedAt: NOW.toISOString() },
    });
    expect(store.getSnapshot().data.history).toHaveLength(1);
    expect(store.getSnapshot().data.collection.boards).toEqual([]);
  });

  test('borrar un tablero que nunca subió lo quita del todo', async () => {
    const { storage, store } = setup();
    const board = create(store, 'Metas');

    store.update((data) => ({
      ...data,
      collection: removeBoard(data.collection, board.id),
    }));
    await settle();

    expect(storage.records.has(board.id)).toBe(false);
  });

  test('borrar un tablero de una cuenta lo deja como borrado pendiente de subir', async () => {
    const board = createBoard('Metas', '3x3', T1);
    const { storage, store } = setup({
      ...EMPTY_LOCAL_DATA,
      records: [local(board, { ownerId: 'ana' })],
    });
    store.setViewer('ana');

    store.update((data) => ({
      ...data,
      collection: removeBoard(data.collection, board.id),
    }));
    await settle();

    expect(stored(storage, board.id)).toMatchObject({
      deletedAt: NOW.toISOString(),
      pending: true,
      board: { updatedAt: NOW.toISOString() },
    });
    expect(store.getSnapshot().data.collection.boards).toEqual([]);
  });

  test('cada cambio parte del estado más reciente, no del de antes', () => {
    const { store } = setup();
    create(store, 'Primero');
    create(store, 'Segundo');

    expect(
      store.getSnapshot().data.collection.boards.map((board) => board.title),
    ).toEqual(['Primero', 'Segundo']);
  });

  test('un cambio que no cambia nada no guarda nada', async () => {
    const { storage, store } = setup();
    store.update((data) => data);
    await settle();

    expect(storage.records.size).toBe(0);
  });

  test('avisa de cada cambio local', () => {
    const { store } = setup();
    let changes = 0;
    store.onLocalChange(() => changes++);

    create(store, 'Metas');

    expect(changes).toBe(1);
  });
});

describe('error al guardar', () => {
  test('se indica, y lo que no se guardó se guarda al reintentar', async () => {
    const { storage, store } = setup();
    storage.failOnSave = true;
    const board = create(store, 'Metas');
    await settle();

    expect(store.getSnapshot().saveError).toBe(true);
    expect(store.getSnapshot().data.collection.boards).toEqual([board]);

    storage.failOnSave = false;
    store.retrySave();
    await settle();

    expect(store.getSnapshot().saveError).toBe(false);
    expect(storage.records.has(board.id)).toBe(true);
  });

  test('un guardado posterior que funciona incluye lo que falló', async () => {
    const { storage, store } = setup();
    storage.failOnSave = true;
    const first = create(store, 'Primero');
    await settle();

    storage.failOnSave = false;
    const second = create(store, 'Segundo');
    await settle();

    expect(storage.records.has(first.id)).toBe(true);
    expect(storage.records.has(second.id)).toBe(true);
    expect(store.getSnapshot().saveError).toBe(false);
  });
});

describe('cuentas', () => {
  test('al iniciar sesión, los tableros sin cuenta pasan a ser de ella y quedan pendientes', async () => {
    const { storage, store } = setup();
    const board = create(store, 'Metas');
    await settle();

    store.setViewer('ana');
    await settle();

    expect(stored(storage, board.id)).toMatchObject({
      ownerId: 'ana',
      pending: true,
    });
    expect(store.pendingFor('ana').map((item) => item.board.id)).toEqual([
      board.id,
    ]);
    expect(store.getSnapshot().pendingCount).toBe(1);
  });

  test('con otra cuenta no se ven los tableros de la primera', () => {
    const ana = createBoard('De Ana', '3x3', T1);
    const { store } = setup({
      ...EMPTY_LOCAL_DATA,
      records: [local(ana, { ownerId: 'ana' })],
    });

    store.setViewer('luis');

    expect(store.getSnapshot().data.collection.boards).toEqual([]);
    expect(store.pendingFor('luis')).toEqual([]);
  });

  test('sin sesión se ven todos los tableros del dispositivo', () => {
    const ana = createBoard('De Ana', '3x3', T1);
    const { store } = setup({
      ...EMPTY_LOCAL_DATA,
      records: [local(ana, { ownerId: 'ana' })],
    });

    store.setViewer(null);

    expect(store.getSnapshot().data.collection.boards).toEqual([ana]);
  });

  test('quitar los tableros de una cuenta no deja nada de ella', async () => {
    const ana = createBoard('De Ana', '3x3', T1);
    const mine = createBoard('Sin cuenta', '3x3', T1);
    const { storage, store } = setup({
      ...EMPTY_LOCAL_DATA,
      records: [local(ana, { ownerId: 'ana' }), local(mine)],
    });

    store.removeOwner('ana');
    await settle();

    expect([...storage.records.keys()]).toEqual([]);
    expect(store.getSnapshot().data.collection.boards).toEqual([mine]);
  });

  test('al borrar la cuenta, sus tableros pasan a ser del dispositivo', async () => {
    const ana = createBoard('De Ana', '3x3', T1);
    const { storage, store } = setup({
      ...EMPTY_LOCAL_DATA,
      records: [local(ana, { ownerId: 'ana', pending: true })],
    });

    store.releaseOwner('ana');
    await settle();

    expect(stored(storage, ana.id)).toMatchObject({
      ownerId: null,
      pending: false,
    });
  });
});

describe('cambios del servidor', () => {
  test('un tablero nuevo del servidor aparece y no queda pendiente', async () => {
    const { storage, store } = setup();
    store.setViewer('ana');
    const board = createBoard('Del servidor', '3x3', T1);

    store.mergeRemote([{ board, archivedAt: null, deletedAt: null }], 'ana');
    await settle();

    expect(store.getSnapshot().data.collection.boards).toEqual([board]);
    expect(stored(storage, board.id)).toEqual(local(board, { ownerId: 'ana' }));
  });

  test('una versión del servidor más reciente sustituye a la local', () => {
    const board = createBoard('Metas', '3x3', T1);
    const { store } = setup({
      ...EMPTY_LOCAL_DATA,
      records: [local(board, { ownerId: 'ana', pending: true })],
    });
    store.setViewer('ana');
    const newer = renameBoard(board, 'Nuevo', T2);

    store.mergeRemote(
      [{ board: newer, archivedAt: null, deletedAt: null }],
      'ana',
    );

    expect(activeBoard(store.getSnapshot().data.collection)?.title).toBe(
      'Nuevo',
    );
    expect(store.pendingFor('ana')).toEqual([]);
  });

  test('un cambio local pendiente más reciente no se pisa', () => {
    const board = createBoard('Metas', '3x3', T1);
    const mine = renameBoard(board, 'Mío', T3);
    const { store } = setup({
      ...EMPTY_LOCAL_DATA,
      records: [local(mine, { ownerId: 'ana', pending: true })],
    });
    store.setViewer('ana');

    store.mergeRemote(
      [
        {
          board: renameBoard(board, 'Servidor', T2),
          archivedAt: null,
          deletedAt: null,
        },
      ],
      'ana',
    );

    expect(activeBoard(store.getSnapshot().data.collection)?.title).toBe('Mío');
    expect(store.pendingFor('ana')).toHaveLength(1);
  });

  test('con force gana siempre el servidor', () => {
    const board = createBoard('Metas', '3x3', T1);
    const mine = renameBoard(board, 'Mío', T2);
    const { store } = setup({
      ...EMPTY_LOCAL_DATA,
      records: [local(mine, { ownerId: 'ana', pending: true })],
    });
    store.setViewer('ana');

    store.mergeRemote(
      [
        {
          board: renameBoard(board, 'Servidor', T2),
          archivedAt: null,
          deletedAt: null,
        },
      ],
      'ana',
      { force: true },
    );

    expect(activeBoard(store.getSnapshot().data.collection)?.title).toBe(
      'Servidor',
    );
  });

  test('un borrado del servidor quita el tablero del dispositivo', async () => {
    const board = createBoard('Metas', '3x3', T1);
    const { storage, store } = setup({
      ...EMPTY_LOCAL_DATA,
      records: [local(board, { ownerId: 'ana' })],
    });
    store.setViewer('ana');

    store.mergeRemote(
      [
        {
          board: { ...board, updatedAt: T2.toISOString() },
          archivedAt: null,
          deletedAt: T2.toISOString(),
        },
      ],
      'ana',
    );
    await settle();

    expect(store.getSnapshot().data.collection.boards).toEqual([]);
    expect(storage.records.has(board.id)).toBe(false);
  });

  test('markSynced deja de marcar como pendiente esa versión', () => {
    const board = createBoard('Metas', '3x3', T1);
    const { store } = setup({
      ...EMPTY_LOCAL_DATA,
      records: [local(board, { ownerId: 'ana', pending: true })],
    });

    store.markSynced(board.id, board.updatedAt);

    expect(store.pendingFor('ana')).toEqual([]);
  });

  test('markSynced no toca un tablero que cambió mientras se subía', () => {
    const board = createBoard('Metas', '3x3', T1);
    const { store } = setup({
      ...EMPTY_LOCAL_DATA,
      records: [
        local(renameBoard(board, 'Otro', T2), {
          ownerId: 'ana',
          pending: true,
        }),
      ],
    });

    store.markSynced(board.id, board.updatedAt);

    expect(store.pendingFor('ana')).toHaveLength(1);
  });

  test('markSynced de un borrado lo quita del dispositivo', async () => {
    const board = createBoard('Metas', '3x3', T1);
    const { storage, store } = setup({
      ...EMPTY_LOCAL_DATA,
      records: [
        local(board, {
          ownerId: 'ana',
          pending: true,
          deletedAt: board.updatedAt,
        }),
      ],
    });
    storage.records.set(board.id, {});

    store.markSynced(board.id, board.updatedAt);
    await settle();

    expect(storage.records.has(board.id)).toBe(false);
  });

  test('el cursor de cada cuenta se guarda', async () => {
    const { storage, store } = setup();

    store.setCursor('ana', '42');
    await settle();

    expect(store.cursorFor('ana')).toBe('42');
    expect((await storage.load()).status).toBe('loaded');
  });
});

describe('dos pestañas', () => {
  test('lo que cambia una pestaña aparece en la otra', async () => {
    const storage = createMemoryStorage();
    const first = createBoardStore(storage, EMPTY_LOCAL_DATA);
    const second = createBoardStore(storage.openTab(), EMPTY_LOCAL_DATA);

    const board = create(first, 'Metas');
    await settle();

    expect(second.getSnapshot().data.collection.boards).toEqual([board]);
  });

  test('un cambio más antiguo de otra pestaña no pisa uno más reciente', async () => {
    const storage = createMemoryStorage();
    const board = createBoard('Metas', '3x3', T1);
    const first = createBoardStore(storage, {
      ...EMPTY_LOCAL_DATA,
      records: [local(board)],
    });
    const second = createBoardStore(storage.openTab(), {
      ...EMPTY_LOCAL_DATA,
      records: [local(renameBoard(board, 'Reciente', T3))],
    });

    first.update((data) => ({
      ...data,
      collection: replaceBoard(
        data.collection,
        renameBoard(board, 'Antiguo', T2),
      ),
    }));
    await settle();

    expect(activeBoard(second.getSnapshot().data.collection)?.title).toBe(
      'Reciente',
    );
  });
});

describe('recuperar una copia', () => {
  test('importa los tableros que no están y los deja pendientes', () => {
    const { store } = setup();
    const existing = create(store, 'Ya estaba');
    const recovered = createBoard('Recuperado', '3x3', T1);

    const added = store.importBoards({
      collection: { boards: [existing, recovered], activeBoardId: existing.id },
      history: [],
    });

    expect(added).toBe(1);
    expect(store.getSnapshot().data.collection.boards).toHaveLength(2);
  });
});
