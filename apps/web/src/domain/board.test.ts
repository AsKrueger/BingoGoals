// @vitest-environment node
import { describe, expect, test } from 'vitest';
import {
  boardDimension,
  createBoard,
  DEFAULT_STYLE,
  toggleCell,
  updateCell,
  updateStyle,
} from './board';

const SIZES = ['3x3', '5x5'] as const;

describe('boardDimension', () => {
  test('devuelve el lado del tablero', () => {
    expect(boardDimension('3x3')).toBe(3);
    expect(boardDimension('5x5')).toBe(5);
  });
});

describe('createBoard', () => {
  test('en 3x3 genera 9 casillas sin completar y sin estrella', () => {
    const board = createBoard('Metas 2027', '3x3');

    expect(board.title).toBe('Metas 2027');
    expect(board.size).toBe('3x3');
    expect(board.cells).toHaveLength(9);
    expect(board.cells.some((cell) => cell.isCentralStar)).toBe(false);
    expect(board.cells.some((cell) => cell.isCompleted)).toBe(false);
  });

  test('en 5x5 genera 25 casillas y la central es la estrella completada', () => {
    const board = createBoard('Metas 2027', '5x5');

    expect(board.cells).toHaveLength(25);
    expect(board.cells[12]).toMatchObject({
      text: 'ESTRELLA',
      isCentralStar: true,
      isCompleted: true,
    });

    const others = board.cells.filter((_, index) => index !== 12);
    expect(others.some((cell) => cell.isCentralStar)).toBe(false);
    expect(others.some((cell) => cell.isCompleted)).toBe(false);
  });

  test.each(SIZES)(
    'en %s numera los objetivos y deja las casillas sin personalizar',
    (size) => {
      const board = createBoard('Metas', size);

      expect(board.cells[0]).toMatchObject({
        text: 'Objetivo 1',
        icon: null,
        imagePath: null,
        color: null,
      });
      expect(board.cells.at(-1)?.text).toBe(`Objetivo ${board.cells.length}`);
    },
  );

  test.each(SIZES)(
    'en %s asigna identificadores únicos, estilo por defecto y fecha',
    (size) => {
      const board = createBoard('Metas', size);
      const ids = [board.id, ...board.cells.map((cell) => cell.id)];

      expect(new Set(ids).size).toBe(ids.length);
      expect(board.style).toEqual(DEFAULT_STYLE);
      expect(new Date(board.createdAt).toISOString()).toBe(board.createdAt);
    },
  );
});

describe('toggleCell', () => {
  test.each(SIZES)('en %s marca y desmarca una casilla', (size) => {
    const board = createBoard('Metas', size);

    const marked = toggleCell(board, 0);
    expect(marked.cells[0]?.isCompleted).toBe(true);

    const unmarked = toggleCell(marked, 0);
    expect(unmarked.cells[0]?.isCompleted).toBe(false);
  });

  test.each(SIZES)(
    'en %s no modifica el tablero recibido ni las demás casillas',
    (size) => {
      const board = createBoard('Metas', size);
      const snapshot = structuredClone(board);

      const result = toggleCell(board, 1);

      expect(board).toEqual(snapshot);
      expect(result).not.toBe(board);
      expect(result.cells).not.toBe(board.cells);
      expect(result.cells[0]).toBe(board.cells[0]);
    },
  );

  test('la estrella central también se puede desmarcar', () => {
    const board = toggleCell(createBoard('Metas', '5x5'), 12);

    expect(board.cells[12]).toMatchObject({
      isCentralStar: true,
      isCompleted: false,
    });
  });

  test.each([-1, 9, 1.5])('rechaza el índice %s', (index) => {
    expect(() => toggleCell(createBoard('Metas', '3x3'), index)).toThrow(
      RangeError,
    );
  });
});

describe('updateCell', () => {
  test.each(SIZES)('en %s cambia solo los campos indicados', (size) => {
    const board = createBoard('Metas', size);

    const result = updateCell(board, 2, {
      text: 'Correr 10 km',
      color: '#FF5722',
    });

    expect(result.cells[2]).toEqual({
      ...board.cells[2],
      text: 'Correr 10 km',
      color: '#FF5722',
    });
  });

  test.each(SIZES)('en %s no modifica el tablero recibido', (size) => {
    const board = createBoard('Metas', size);
    const snapshot = structuredClone(board);

    const result = updateCell(board, 0, { text: 'Leer 12 libros' });

    expect(board).toEqual(snapshot);
    expect(result).not.toBe(board);
  });

  test('permite quitar el icono, la imagen y el color con null', () => {
    const board = updateCell(createBoard('Metas', '3x3'), 0, {
      icon: 'star',
      imagePath: 'foto.jpg',
      color: '#FF5722',
    });

    const result = updateCell(board, 0, {
      icon: null,
      imagePath: null,
      color: null,
    });

    expect(result.cells[0]).toMatchObject({
      icon: null,
      imagePath: null,
      color: null,
    });
  });

  test('no cambia si la casilla está completada ni si es la estrella', () => {
    const board = createBoard('Metas', '5x5');

    const result = updateCell(board, 12, { text: 'Mi estrella' });

    expect(result.cells[12]).toMatchObject({
      text: 'Mi estrella',
      isCentralStar: true,
      isCompleted: true,
    });
  });

  test('rechaza un índice fuera del tablero', () => {
    expect(() =>
      updateCell(createBoard('Metas', '3x3'), 9, { text: 'x' }),
    ).toThrow(RangeError);
  });
});

describe('updateStyle', () => {
  test.each(SIZES)(
    'en %s cambia el tema y conserva el resto del estilo',
    (size) => {
      const board = createBoard('Metas', size);

      const result = updateStyle(board, { theme: 'sakura' });

      expect(result.style).toEqual({ ...DEFAULT_STYLE, theme: 'sakura' });
      expect(result.cells).toBe(board.cells);
    },
  );

  test.each(SIZES)('en %s no modifica el tablero recibido', (size) => {
    const board = createBoard('Metas', size);
    const snapshot = structuredClone(board);

    updateStyle(board, { theme: 'christmas' });

    expect(board).toEqual(snapshot);
  });
});
