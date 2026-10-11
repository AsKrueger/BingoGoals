import { boardDimension } from './board';
import type { BingoBoard, BingoLine, BingoProgress, BingoWin } from './types';

function boardLines(board: BingoBoard): BingoLine[] {
  const n = boardDimension(board.size);
  const range = Array.from({ length: n }, (_, i) => i);

  return [
    ...range.map((row): BingoLine => ({
      type: 'row',
      index: row,
      cells: range.map((column) => row * n + column),
    })),
    ...range.map((column): BingoLine => ({
      type: 'column',
      index: column,
      cells: range.map((row) => row * n + column),
    })),
    { type: 'diagonal', index: 0, cells: range.map((i) => i * (n + 1)) },
    { type: 'diagonal', index: 1, cells: range.map((i) => (i + 1) * (n - 1)) },
  ];
}

export function completedLines(board: BingoBoard): BingoLine[] {
  return boardLines(board).filter((line) =>
    line.cells.every((index) => board.cells[index]?.isCompleted),
  );
}

function isFullBingo(board: BingoBoard): boolean {
  return board.cells.every((cell) => cell.isCompleted);
}

/**
 * Indica qué hay que celebrar al pasar de `before` a `after`: un bingo completo,
 * al menos una línea que antes no estaba completa, o nada.
 */
export function newWin(before: BingoBoard, after: BingoBoard): BingoWin {
  if (isFullBingo(after)) {
    return isFullBingo(before) ? 'none' : 'bingo';
  }

  const previous = new Set(
    completedLines(before).map((line) => `${line.type}:${line.index}`),
  );
  const hasNewLine = completedLines(after).some(
    (line) => !previous.has(`${line.type}:${line.index}`),
  );
  return hasNewLine ? 'line' : 'none';
}

export function progress(board: BingoBoard): BingoProgress {
  const total = board.cells.length;
  const completed = board.cells.filter((cell) => cell.isCompleted).length;
  return {
    completed,
    total,
    percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}
