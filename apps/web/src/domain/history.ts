import type { BingoBoard } from './types';

export interface ArchivedBoard {
  readonly board: BingoBoard;
  /** Fecha de archivo en formato ISO 8601. */
  readonly archivedAt: string;
}

/** Tableros archivados, del más reciente al más antiguo. */
export type BoardHistory = readonly ArchivedBoard[];

export const EMPTY_HISTORY: BoardHistory = [];

export function archiveBoard(
  history: BoardHistory,
  board: BingoBoard,
  archivedAt: Date = new Date(),
): BoardHistory {
  const entry: ArchivedBoard = { board, archivedAt: archivedAt.toISOString() };
  return [...history, entry].sort((a, b) =>
    b.archivedAt.localeCompare(a.archivedAt),
  );
}

export function removeFromHistory(
  history: BoardHistory,
  boardId: string,
): BoardHistory {
  return history.filter((entry) => entry.board.id !== boardId);
}
