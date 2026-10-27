import type { BingoBoard } from './types.js';

export interface BoardCollection {
  readonly boards: readonly BingoBoard[];
  readonly activeBoardId: string | null;
}

export const EMPTY_COLLECTION: BoardCollection = {
  boards: [],
  activeBoardId: null,
};

export function activeBoard(collection: BoardCollection): BingoBoard | null {
  return (
    collection.boards.find((board) => board.id === collection.activeBoardId) ??
    null
  );
}

/** Añade el tablero al final y lo deja como activo. */
export function addBoard(
  collection: BoardCollection,
  board: BingoBoard,
): BoardCollection {
  return {
    boards: [...collection.boards, board],
    activeBoardId: board.id,
  };
}

/** Si se elimina el activo, pasa a serlo el primero que quede, o ninguno. */
export function removeBoard(
  collection: BoardCollection,
  boardId: string,
): BoardCollection {
  const boards = collection.boards.filter((board) => board.id !== boardId);
  const activeBoardId =
    collection.activeBoardId === boardId
      ? (boards[0]?.id ?? null)
      : collection.activeBoardId;
  return { boards, activeBoardId };
}

export function activateBoard(
  collection: BoardCollection,
  boardId: string,
): BoardCollection {
  if (!collection.boards.some((board) => board.id === boardId)) {
    throw new RangeError(`No existe el tablero ${boardId} en la colección.`);
  }
  return { ...collection, activeBoardId: boardId };
}

/** Sustituye el tablero que tiene el mismo id, sin cambiar el activo. */
export function replaceBoard(
  collection: BoardCollection,
  board: BingoBoard,
): BoardCollection {
  return {
    ...collection,
    boards: collection.boards.map((current) =>
      current.id === board.id ? board : current,
    ),
  };
}
