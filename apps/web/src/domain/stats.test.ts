// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { createBoard, toggleCell } from './board';
import { boardStats } from './stats';
import type { BingoBoard, BingoSize } from './types';

function boardWith(size: BingoSize, completed: readonly number[]): BingoBoard {
  const board = createBoard('Metas', size);
  return {
    ...board,
    createdAt: '2026-10-01T12:00:00.000Z',
    cells: board.cells.map((cell, index) => ({
      ...cell,
      isCompleted: completed.includes(index),
    })),
  };
}

function allCells(size: BingoSize): number[] {
  return Array.from({ length: size === '3x3' ? 9 : 25 }, (_, i) => i);
}

describe('boardStats', () => {
  test('un 3x3 recién creado no tiene nada completado', () => {
    const board = createBoard('Metas', '3x3');

    expect(boardStats(board, new Date(board.createdAt))).toEqual({
      completed: 0,
      pending: 9,
      total: 9,
      percentage: 0,
      lines: { completed: 0, total: 8 },
      linesByType: {
        row: { completed: 0, total: 3 },
        column: { completed: 0, total: 3 },
        diagonal: { completed: 0, total: 2 },
      },
      daysSinceCreation: 0,
    });
  });

  test('un 5x5 recién creado cuenta la estrella central', () => {
    const board = createBoard('Metas', '5x5');

    expect(boardStats(board)).toMatchObject({
      completed: 1,
      pending: 24,
      total: 25,
      percentage: 4,
      lines: { completed: 0, total: 12 },
    });
  });

  test('en 3x3 cuenta casillas y líneas por tipo', () => {
    // Fila 0, columna 0 y las dos diagonales.
    const stats = boardStats(boardWith('3x3', [0, 1, 2, 3, 6, 4, 8]));

    expect(stats).toMatchObject({
      completed: 7,
      pending: 2,
      percentage: 78,
      lines: { completed: 4, total: 8 },
      linesByType: {
        row: { completed: 1, total: 3 },
        column: { completed: 1, total: 3 },
        diagonal: { completed: 2, total: 2 },
      },
    });
  });

  test('en 5x5 cuenta casillas y líneas por tipo', () => {
    // Filas 0 y 1 completas.
    const stats = boardStats(boardWith('5x5', allCells('5x5').slice(0, 10)));

    expect(stats).toMatchObject({
      completed: 10,
      pending: 15,
      percentage: 40,
      lines: { completed: 2, total: 12 },
      linesByType: {
        row: { completed: 2, total: 5 },
        column: { completed: 0, total: 5 },
        diagonal: { completed: 0, total: 2 },
      },
    });
  });

  test.each([
    ['3x3', 8],
    ['5x5', 12],
  ] as const)('un %s lleno tiene sus %i líneas', (size, lines) => {
    const stats = boardStats(boardWith(size, allCells(size)));

    expect(stats.pending).toBe(0);
    expect(stats.percentage).toBe(100);
    expect(stats.lines).toEqual({ completed: lines, total: lines });
  });

  test('se recalcula al marcar una casilla', () => {
    const board = boardWith('3x3', [0, 1]);

    const after = boardStats(toggleCell(board, 2));

    expect(boardStats(board).lines.completed).toBe(0);
    expect(after.completed).toBe(3);
    expect(after.lines.completed).toBe(1);
  });

  test.each([
    ['2026-10-01T12:00:00.000Z', 0],
    ['2026-10-02T11:59:59.000Z', 0],
    ['2026-10-02T12:00:00.000Z', 1],
    ['2026-10-11T18:00:00.000Z', 10],
    ['2026-09-30T12:00:00.000Z', 0],
  ])('el %s han pasado %i días desde la creación', (now, days) => {
    const board = boardWith('3x3', []);

    expect(boardStats(board, new Date(now)).daysSinceCreation).toBe(days);
  });
});
