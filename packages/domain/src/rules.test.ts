// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { createBoard, toggleCell } from './board.js';
import { completedLines, newWin, progress } from './rules.js';
import type { BingoBoard, BingoSize } from './types.js';

const SIZES = ['3x3', '5x5'] as const;

/** Tablero con exactamente las casillas indicadas completadas. */
function boardWith(size: BingoSize, completed: readonly number[]): BingoBoard {
  const board = createBoard('Metas', size);
  return {
    ...board,
    cells: board.cells.map((cell, index) => ({
      ...cell,
      isCompleted: completed.includes(index),
    })),
  };
}

function allCells(size: BingoSize): number[] {
  return Array.from({ length: size === '3x3' ? 9 : 25 }, (_, i) => i);
}

describe('completedLines', () => {
  test.each([
    ['3x3', 'row', 1, [3, 4, 5]],
    ['3x3', 'column', 2, [2, 5, 8]],
    ['3x3', 'diagonal', 0, [0, 4, 8]],
    ['3x3', 'diagonal', 1, [2, 4, 6]],
    ['5x5', 'row', 3, [15, 16, 17, 18, 19]],
    ['5x5', 'column', 4, [4, 9, 14, 19, 24]],
    ['5x5', 'diagonal', 0, [0, 6, 12, 18, 24]],
    ['5x5', 'diagonal', 1, [4, 8, 12, 16, 20]],
  ] as const)('en %s detecta %s %i', (size, type, index, cells) => {
    const board = boardWith(size, cells);

    expect(completedLines(board)).toEqual([{ type, index, cells }]);
  });

  test.each(SIZES)(
    'en %s no hay líneas en un tablero recién creado',
    (size) => {
      expect(completedLines(createBoard('Metas', size))).toEqual([]);
    },
  );

  test.each([
    ['3x3', [0, 1, 4, 5]],
    ['5x5', [0, 1, 2, 3, 9]],
  ] as const)('en %s una línea incompleta no cuenta', (size, cells) => {
    expect(completedLines(boardWith(size, cells))).toEqual([]);
  });

  test.each([
    ['3x3', 8],
    ['5x5', 12],
  ] as const)('en %s un tablero lleno tiene %i líneas', (size, count) => {
    expect(completedLines(boardWith(size, allCells(size)))).toHaveLength(count);
  });

  test('en 5x5 la estrella central cuenta para completar su fila', () => {
    let board = createBoard('Metas', '5x5');
    for (const index of [10, 11, 13, 14]) {
      board = toggleCell(board, index);
    }

    expect(completedLines(board)).toMatchObject([{ type: 'row', index: 2 }]);
  });
});

describe('newWin', () => {
  test.each([
    ['3x3', [0, 1], 2],
    ['5x5', [0, 1, 2, 3], 4],
  ] as const)('en %s completar una línea da "line"', (size, cells, last) => {
    const before = boardWith(size, cells);

    expect(newWin(before, toggleCell(before, last))).toBe('line');
  });

  test.each([
    ['3x3', 4],
    ['5x5', 12],
  ] as const)(
    'en %s completar varias líneas a la vez da "line"',
    (size, center) => {
      const before = boardWith(
        size,
        allCells(size).filter((index) => index !== center && index !== 1),
      );

      expect(newWin(before, toggleCell(before, center))).toBe('line');
    },
  );

  test.each(SIZES)(
    'en %s marcar una casilla que no completa nada da "none"',
    (size) => {
      const before = createBoard('Metas', size);

      expect(newWin(before, toggleCell(before, 0))).toBe('none');
    },
  );

  test.each([
    ['3x3', [0, 1, 2], 4],
    ['5x5', [0, 1, 2, 3, 4], 6],
  ] as const)(
    'en %s una línea ya completa no cuenta como nueva al cambiar otra casilla',
    (size, line, other) => {
      const before = boardWith(size, line);

      expect(newWin(before, toggleCell(before, other))).toBe('none');
    },
  );

  test.each([
    ['3x3', [0, 1, 2]],
    ['5x5', [0, 1, 2, 3, 4]],
  ] as const)(
    'en %s desmarcar y volver a completar una línea la celebra de nuevo',
    (size, line) => {
      const complete = boardWith(size, line);
      const broken = toggleCell(complete, 0);

      expect(newWin(complete, broken)).toBe('none');
      expect(newWin(broken, toggleCell(broken, 0))).toBe('line');
    },
  );

  test.each(SIZES)('en %s completar la última casilla da "bingo"', (size) => {
    const before = boardWith(size, allCells(size).slice(1));

    expect(newWin(before, toggleCell(before, 0))).toBe('bingo');
  });

  test.each(SIZES)('en %s un tablero que ya estaba lleno da "none"', (size) => {
    const full = boardWith(size, allCells(size));

    expect(newWin(full, full)).toBe('none');
  });

  test.each(SIZES)(
    'en %s desmarcar una casilla de un tablero lleno da "none"',
    (size) => {
      const full = boardWith(size, allCells(size));

      expect(newWin(full, toggleCell(full, 0))).toBe('none');
    },
  );
});

describe('progress', () => {
  test('un 3x3 recién creado no tiene casillas completadas', () => {
    expect(progress(createBoard('Metas', '3x3'))).toEqual({
      completed: 0,
      total: 9,
      percentage: 0,
    });
  });

  test('un 5x5 recién creado ya cuenta la estrella', () => {
    expect(progress(createBoard('Metas', '5x5'))).toEqual({
      completed: 1,
      total: 25,
      percentage: 4,
    });
  });

  test('redondea el porcentaje al entero más cercano', () => {
    expect(progress(boardWith('3x3', [0, 1, 2]))).toEqual({
      completed: 3,
      total: 9,
      percentage: 33,
    });
    expect(progress(boardWith('5x5', [0, 1, 2]))).toEqual({
      completed: 3,
      total: 25,
      percentage: 12,
    });
  });

  test.each(SIZES)('en %s un tablero lleno llega a 100', (size) => {
    expect(progress(boardWith(size, allCells(size))).percentage).toBe(100);
  });
});
