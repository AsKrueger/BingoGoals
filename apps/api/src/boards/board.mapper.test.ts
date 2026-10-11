import { createBoard, toggleCell, updateCell } from '@bingogoals/domain';
import { describe, expect, test } from 'vitest';
import type { Board } from '../generated/prisma/client.js';
import { fromBoardRow, toBoardRow } from './board.mapper.js';

const USER_ID = '7b0c1f0e-1d2c-4b5a-9e8f-0a1b2c3d4e5f';
const CREATED = new Date('2026-10-01T10:00:00.000Z');
const UPDATED = new Date('2026-10-02T18:30:00.000Z');

function sampleBoard(size: '3x3' | '5x5' = '3x3') {
  let board = createBoard('Metas', size, CREATED);
  board = updateCell(
    board,
    0,
    { text: 'Correr 10 km', icon: '🏋️', color: '#2196F3' },
    UPDATED,
  );
  return toggleCell(board, 0, UPDATED);
}

/** La fila tal como la devolvería la base de datos para ese tablero. */
function rowOf(
  board: ReturnType<typeof sampleBoard>,
  archivedAt: string | null = null,
): Board {
  return JSON.parse(
    JSON.stringify(toBoardRow({ board, archivedAt }, USER_ID)),
    (key, value: unknown) =>
      ['createdAt', 'updatedAt', 'archivedAt'].includes(key) &&
      typeof value === 'string'
        ? new Date(value)
        : value,
  ) as Board;
}

describe('toBoardRow', () => {
  test('lleva cada dato del tablero a su columna', () => {
    const board = sampleBoard('5x5');

    expect(toBoardRow({ board, archivedAt: null }, USER_ID)).toEqual({
      id: board.id,
      userId: USER_ID,
      title: 'Metas',
      size: '5x5',
      style: { theme: 'classic' },
      cells: board.cells,
      createdAt: CREATED,
      updatedAt: UPDATED,
      archivedAt: null,
    });
  });

  test('un tablero archivado lleva su fecha de archivo', () => {
    const row = toBoardRow(
      { board: sampleBoard(), archivedAt: '2026-10-05T09:00:00.000Z' },
      USER_ID,
    );

    expect(row.archivedAt).toEqual(new Date('2026-10-05T09:00:00.000Z'));
  });
});

describe('fromBoardRow', () => {
  test.each(['3x3', '5x5'] as const)(
    'recupera un tablero %s idéntico al que se guardó',
    (size) => {
      const board = sampleBoard(size);

      expect(fromBoardRow(rowOf(board))).toEqual({ board, archivedAt: null });
    },
  );

  test('recupera la fecha de archivo', () => {
    const board = sampleBoard();

    expect(
      fromBoardRow(rowOf(board, '2026-10-05T09:00:00.000Z')).archivedAt,
    ).toBe('2026-10-05T09:00:00.000Z');
  });

  test.each<[string, (row: Board) => void]>([
    ['el tamaño no existe', (row) => (row.size = '4x4')],
    [
      'el estilo no tiene un tema conocido',
      (row) => (row.style = { theme: 'x' }),
    ],
    ['las casillas no son una lista', (row) => (row.cells = 'casillas')],
    [
      'faltan casillas para su tamaño',
      (row) =>
        (row.cells = (row.cells as unknown[]).slice(1) as Board['cells']),
    ],
    [
      'una casilla lleva una foto que no es una imagen',
      (row) => {
        const cells = row.cells as { imagePath: string }[];
        cells[0]!.imagePath = 'https://example.com/foto.png';
      },
    ],
  ])('rechaza una fila si %s', (_, corrupt) => {
    const row = rowOf(sampleBoard());
    corrupt(row);

    expect(() => fromBoardRow(row)).toThrow('no es válido');
  });
});
