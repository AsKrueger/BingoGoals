// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { createBoard } from './board.js';
import { archiveBoard, EMPTY_HISTORY, removeFromHistory } from './history.js';

const first = createBoard('Primero', '3x3');
const second = createBoard('Segundo', '5x5');
const third = createBoard('Tercero', '3x3');

const monday = new Date('2026-10-05T10:00:00.000Z');
const tuesday = new Date('2026-10-06T10:00:00.000Z');
const wednesday = new Date('2026-10-07T10:00:00.000Z');

describe('archiveBoard', () => {
  test('guarda el tablero con su fecha de archivo', () => {
    const history = archiveBoard(EMPTY_HISTORY, first, monday);

    expect(history).toEqual([
      { board: first, archivedAt: '2026-10-05T10:00:00.000Z' },
    ]);
    expect(history[0]?.board).toBe(first);
  });

  test('por defecto usa la fecha actual', () => {
    const before = Date.now();

    const [entry] = archiveBoard(EMPTY_HISTORY, first);

    const archivedAt = new Date(entry?.archivedAt ?? '').getTime();
    expect(archivedAt).toBeGreaterThanOrEqual(before);
    expect(archivedAt).toBeLessThanOrEqual(Date.now());
  });

  test('ordena del más reciente al más antiguo', () => {
    let history = archiveBoard(EMPTY_HISTORY, first, monday);
    history = archiveBoard(history, second, wednesday);
    history = archiveBoard(history, third, tuesday);

    expect(history.map((entry) => entry.board.title)).toEqual([
      'Segundo',
      'Tercero',
      'Primero',
    ]);
  });

  test('no modifica el historial recibido', () => {
    const history = archiveBoard(EMPTY_HISTORY, first, monday);
    const snapshot = structuredClone(history);

    archiveBoard(history, second, tuesday);

    expect(history).toEqual(snapshot);
    expect(EMPTY_HISTORY).toEqual([]);
  });
});

describe('removeFromHistory', () => {
  test('elimina el tablero indicado y conserva el orden del resto', () => {
    let history = archiveBoard(EMPTY_HISTORY, first, monday);
    history = archiveBoard(history, second, tuesday);
    history = archiveBoard(history, third, wednesday);

    const result = removeFromHistory(history, second.id);

    expect(result.map((entry) => entry.board.title)).toEqual([
      'Tercero',
      'Primero',
    ]);
  });

  test('ignora un tablero que no está en el historial', () => {
    const history = archiveBoard(EMPTY_HISTORY, first, monday);

    expect(removeFromHistory(history, second.id)).toEqual(history);
  });

  test('no modifica el historial recibido', () => {
    const history = archiveBoard(EMPTY_HISTORY, first, monday);
    const snapshot = structuredClone(history);

    removeFromHistory(history, first.id);

    expect(history).toEqual(snapshot);
  });
});
