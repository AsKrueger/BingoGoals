// @vitest-environment node
import { describe, expect, test } from 'vitest';
import {
  boardDimension,
  createBoard,
  DEFAULT_STYLE,
  renameBoard,
  resetBoard,
  toggleCell,
  updateCell,
  updateStyle,
} from './board.js';

const SIZES = ['3x3', '5x5'] as const;

const CREATED = new Date('2026-10-01T10:00:00.000Z');
const LATER = new Date('2026-10-02T18:30:00.000Z');
const PHOTO_ID = '0b7c8f3e-5a2d-4c1b-9e6f-1a2b3c4d5e6f';

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
        photoId: null,
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

  test('permite quitar el icono, la foto y el color con null', () => {
    const board = updateCell(createBoard('Metas', '3x3'), 0, {
      icon: 'star',
      photoId: PHOTO_ID,
      color: '#FF5722',
    });

    const result = updateCell(board, 0, {
      icon: null,
      photoId: null,
      color: null,
    });

    expect(result.cells[0]).toMatchObject({
      icon: null,
      photoId: null,
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

describe('renameBoard', () => {
  test.each(SIZES)('en %s cambia el título y conserva lo demás', (size) => {
    const board = createBoard('Metas', size);
    const snapshot = structuredClone(board);

    const result = renameBoard(board, 'Metas de otoño', LATER);

    expect(result).toEqual({
      ...board,
      title: 'Metas de otoño',
      updatedAt: LATER.toISOString(),
    });
    expect(result.cells).toBe(board.cells);
    expect(board).toEqual(snapshot);
  });
});

describe('resetBoard', () => {
  function playedBoard(size: (typeof SIZES)[number]) {
    let board = createBoard('Metas', size);
    board = updateCell(board, 0, {
      text: 'Correr',
      icon: '🏋️',
      color: '#F44336',
    });
    board = updateCell(board, 1, { photoId: PHOTO_ID });
    for (const index of [0, 1, 2, 5]) {
      board = toggleCell(board, index);
    }
    return board;
  }

  test.each(SIZES)('en %s desmarca todas las casillas normales', (size) => {
    const result = resetBoard(playedBoard(size));

    const normal = result.cells.filter((cell) => !cell.isCentralStar);
    expect(normal.some((cell) => cell.isCompleted)).toBe(false);
  });

  test.each(SIZES)('en %s conserva textos, iconos, fotos y colores', (size) => {
    const board = playedBoard(size);

    const result = resetBoard(board);

    expect(result.cells[0]).toEqual({ ...board.cells[0], isCompleted: false });
    expect(result.cells[1]?.photoId).toBe(PHOTO_ID);
    expect(result.title).toBe(board.title);
    expect(result.style).toBe(board.style);
  });

  test('en 5x5 la estrella central sigue completada', () => {
    const result = resetBoard(playedBoard('5x5'));

    expect(result.cells[12]).toMatchObject({
      isCentralStar: true,
      isCompleted: true,
    });
  });

  test('en 5x5 vuelve a completar la estrella si estaba desmarcada', () => {
    const board = toggleCell(createBoard('Metas', '5x5'), 12);

    expect(resetBoard(board).cells[12]?.isCompleted).toBe(true);
  });

  test.each(SIZES)('en %s no modifica el tablero recibido', (size) => {
    const board = playedBoard(size);
    const snapshot = structuredClone(board);

    resetBoard(board);

    expect(board).toEqual(snapshot);
  });
});

describe('fecha de modificación', () => {
  test.each(SIZES)(
    'un tablero %s nuevo nace con las dos fechas iguales',
    (size) => {
      const board = createBoard('Metas', size, CREATED);

      expect(board.createdAt).toBe('2026-10-01T10:00:00.000Z');
      expect(board.updatedAt).toBe(board.createdAt);
    },
  );

  test('por defecto se usa la fecha actual', () => {
    const before = Date.now();

    const board = createBoard('Metas', '3x3');
    const changed = toggleCell(board, 0);

    for (const date of [board.createdAt, board.updatedAt, changed.updatedAt]) {
      expect(new Date(date).getTime()).toBeGreaterThanOrEqual(before);
      expect(new Date(date).getTime()).toBeLessThanOrEqual(Date.now());
    }
  });

  test.each([
    ['toggleCell', (board) => toggleCell(board, 0, LATER)],
    ['updateCell', (board) => updateCell(board, 0, { text: 'Leer' }, LATER)],
    ['updateStyle', (board) => updateStyle(board, { theme: 'sakura' }, LATER)],
    ['renameBoard', (board) => renameBoard(board, 'Otro', LATER)],
    ['resetBoard', (board) => resetBoard(board, LATER)],
  ] as [
    string,
    (board: ReturnType<typeof createBoard>) => ReturnType<typeof createBoard>,
  ][])(
    '%s actualiza la fecha de modificación y conserva la de creación',
    (_, change) => {
      for (const size of SIZES) {
        const board = createBoard('Metas', size, CREATED);

        const result = change(board);

        expect(result.updatedAt).toBe('2026-10-02T18:30:00.000Z');
        expect(result.createdAt).toBe('2026-10-01T10:00:00.000Z');
        expect(board.updatedAt).toBe('2026-10-01T10:00:00.000Z');
      }
    },
  );

  test('el estilo de un tablero nuevo solo tiene el tema', () => {
    expect(createBoard('Metas', '3x3').style).toEqual({ theme: 'classic' });
    expect(DEFAULT_STYLE).toEqual({ theme: 'classic' });
  });
});

describe('títulos', () => {
  test('createBoard y renameBoard quitan los espacios sobrantes', () => {
    const board = createBoard('  Metas  ', '3x3');

    expect(board.title).toBe('Metas');
    expect(renameBoard(board, ' Otras ').title).toBe('Otras');
  });

  test.each(['', '   ', 'x'.repeat(41)])(
    'createBoard y renameBoard rechazan el título «%s»',
    (title) => {
      expect(() => createBoard(title, '3x3')).toThrow(RangeError);
      expect(() => renameBoard(createBoard('Metas', '3x3'), title)).toThrow(
        RangeError,
      );
    },
  );
});
