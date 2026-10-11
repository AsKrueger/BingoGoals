import { boardDimension } from './board.js';
import { completedLines, progress } from './rules.js';
import type { BingoBoard, BingoLineType } from './types.js';

export interface LineCount {
  readonly completed: number;
  readonly total: number;
}

export interface BoardStats {
  readonly completed: number;
  readonly pending: number;
  readonly total: number;
  /** Entero entre 0 y 100. */
  readonly percentage: number;
  readonly lines: LineCount;
  readonly linesByType: Readonly<Record<BingoLineType, LineCount>>;
  /** Días enteros transcurridos desde la creación del tablero. */
  readonly daysSinceCreation: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Se calcula siempre a partir del tablero: no hay contadores guardados. */
export function boardStats(
  board: BingoBoard,
  now: Date = new Date(),
): BoardStats {
  const { completed, total, percentage } = progress(board);
  const dimension = boardDimension(board.size);
  const lines = completedLines(board);
  const count = (type: BingoLineType) =>
    lines.filter((line) => line.type === type).length;

  const elapsed = now.getTime() - new Date(board.createdAt).getTime();

  return {
    completed,
    pending: total - completed,
    total,
    percentage,
    lines: { completed: lines.length, total: dimension * 2 + 2 },
    linesByType: {
      row: { completed: count('row'), total: dimension },
      column: { completed: count('column'), total: dimension },
      diagonal: { completed: count('diagonal'), total: 2 },
    },
    daysSinceCreation: Math.max(0, Math.floor(elapsed / MS_PER_DAY)),
  };
}
