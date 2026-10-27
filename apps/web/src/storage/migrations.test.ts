// @vitest-environment node
import { isBingoBoard } from '@bingogoals/domain';
import { describe, expect, test } from 'vitest';
import storedV1 from './fixtures/stored-v1.json';
import { migrateStoredData } from './migrations';
import { readLegacyRecord, RECORD_VERSION } from './schema';
import type { AppData } from './storage';
import { withoutPhotoIds } from './testData';

// fixtures/stored-v1.json es un registro real de la versión 1: lo generó el
// código de la fase 1 (commit 3a78468) con dos tableros y uno archivado.

/** Copia del registro de la versión 1, para que ningún test altere el original. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function v1(): any {
  return structuredClone(storedV1);
}

function loaded(raw: unknown): AppData {
  const result = readLegacyRecord(raw);
  if (result.status !== 'loaded') {
    throw new Error(`Se esperaban datos y la carga dio «${result.status}».`);
  }
  return result.data;
}

describe('el registro de la versión 1', () => {
  test('tiene el formato antiguo', () => {
    const board = v1().collection.boards[0];

    expect(v1().version).toBe(1);
    expect(board.style).toEqual({
      theme: 'sakura',
      primaryColor: '#6200EE',
      fontFamily: 'Poppins',
    });
    expect(board).not.toHaveProperty('updatedAt');
  });
});

describe('migración de la versión 1 a la 2', () => {
  test('un registro de la versión 1 deja de ser ilegible', () => {
    expect(readLegacyRecord(v1()).status).toBe('loaded');
  });

  test('el registro migrado lleva la versión actual', () => {
    expect(migrateStoredData(v1())).toMatchObject({
      version: RECORD_VERSION,
    });
  });

  test('no se pierde ningún tablero ni el tablero activo', () => {
    const data = loaded(v1());

    expect(data.collection.boards.map((board) => board.title)).toEqual([
      'Primero',
      'Segundo',
    ]);
    expect(data.collection.boards.map((board) => board.id)).toEqual(
      v1().collection.boards.map((board: { id: string }) => board.id),
    );
    expect(data.collection.activeBoardId).toBe(v1().collection.activeBoardId);
  });

  test('las casillas quedan idénticas: texto, icono, color, foto y estado', () => {
    const data = loaded(v1());

    data.collection.boards.forEach((board, index) => {
      expect(withoutPhotoIds(board).cells).toEqual(
        withoutPhotoIds(v1().collection.boards[index]).cells,
      );
    });
    expect(data.collection.boards[0]?.cells[0]).toMatchObject({
      text: 'Correr 10 km',
      icon: '🏋️',
      color: '#2196F3',
      photoId: expect.any(String),
      isCompleted: true,
    });
    expect(data.collection.boards[1]?.cells[12]).toMatchObject({
      isCentralStar: true,
      isCompleted: true,
    });
  });

  test('no se pierde el historial ni su fecha de archivo', () => {
    const data = loaded(v1());

    expect(data.history).toHaveLength(1);
    expect(data.history[0]?.archivedAt).toBe('2026-10-05T10:00:00.000Z');
    expect(data.history[0]?.board.title).toBe('Archivado');
    expect(withoutPhotoIds(data.history[0]?.board).cells).toEqual(
      withoutPhotoIds(v1().history[0].board).cells,
    );
  });

  test('el estilo conserva el tema y pierde los dos campos sin uso', () => {
    const data = loaded(v1());

    expect(data.collection.boards[0]?.style).toEqual({ theme: 'sakura' });
    expect(data.collection.boards[1]?.style).toEqual({ theme: 'classic' });
    expect(data.history[0]?.board.style).toEqual({ theme: 'classic' });
    expect(JSON.stringify(data)).not.toMatch(/primaryColor|fontFamily/);
  });

  test('updatedAt empieza igual que createdAt, también en los archivados', () => {
    const data = loaded(v1());
    const boards = [
      ...data.collection.boards,
      ...data.history.map((entry) => entry.board),
    ];

    expect(boards).toHaveLength(3);
    for (const board of boards) {
      expect(board.updatedAt).toBe(board.createdAt);
      expect(isBingoBoard(board)).toBe(true);
    }
    expect(data.collection.boards[0]?.createdAt).toBe(
      v1().collection.boards[0].createdAt,
    );
  });

  test('no modifica el registro recibido', () => {
    const raw = v1();

    migrateStoredData(raw);

    expect(raw).toEqual(storedV1);
  });

  test('un registro que ya es de la versión actual no cambia', () => {
    const current = migrateStoredData(v1());

    expect(migrateStoredData(current)).toBe(current);
  });

  test.each([
    ['sin colección', (raw: ReturnType<typeof v1>) => delete raw.collection],
    [
      'con el historial roto',
      (raw: ReturnType<typeof v1>) => (raw.history = 7),
    ],
    [
      'con un tablero que no es un objeto',
      (raw: ReturnType<typeof v1>) => (raw.collection.boards[0] = 'tablero'),
    ],
    [
      'con un tablero sin fecha de creación',
      (raw: ReturnType<typeof v1>) => delete raw.collection.boards[0].createdAt,
    ],
    [
      'con un tablero sin estilo',
      (raw: ReturnType<typeof v1>) => delete raw.collection.boards[0].style,
    ],
  ])('un registro de la versión 1 %s sigue siendo ilegible', (_, corrupt) => {
    const raw = v1();
    corrupt(raw);

    expect(() => migrateStoredData(raw)).not.toThrow();
    expect(readLegacyRecord(raw).status).toBe('unreadable');
  });

  test.each([
    undefined,
    null,
    'texto',
    42,
    [],
    {},
    { version: 0 },
    { version: 3 },
  ])(
    'lo que no es un registro de la versión 1 (%s) se devuelve tal cual',
    (raw) => {
      expect(migrateStoredData(raw)).toBe(raw);
    },
  );
});
