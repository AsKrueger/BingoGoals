// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { createBoard, toggleCell } from './board.js';
import {
  activateBoard,
  activeBoard,
  addBoard,
  EMPTY_COLLECTION,
  removeBoard,
  replaceBoard,
} from './collection.js';

const first = createBoard('Primero', '3x3');
const second = createBoard('Segundo', '5x5');
const third = createBoard('Tercero', '3x3');

function collectionOf(...boards: (typeof first)[]) {
  return boards.reduce(addBoard, EMPTY_COLLECTION);
}

describe('colección vacía', () => {
  test('no tiene tableros ni tablero activo', () => {
    expect(EMPTY_COLLECTION.boards).toEqual([]);
    expect(activeBoard(EMPTY_COLLECTION)).toBeNull();
  });
});

describe('addBoard', () => {
  test('añade el tablero al final y lo activa', () => {
    const collection = addBoard(collectionOf(first), second);

    expect(collection.boards).toEqual([first, second]);
    expect(activeBoard(collection)).toBe(second);
  });

  test('no modifica la colección recibida', () => {
    const collection = collectionOf(first);
    const snapshot = structuredClone(collection);

    addBoard(collection, second);

    expect(collection).toEqual(snapshot);
  });
});

describe('activateBoard', () => {
  test('cambia el tablero activo sin tocar los tableros', () => {
    const collection = collectionOf(first, second);

    const result = activateBoard(collection, first.id);

    expect(activeBoard(result)).toBe(first);
    expect(result.boards).toBe(collection.boards);
    expect(activeBoard(collection)).toBe(second);
  });

  test('rechaza un tablero que no está en la colección', () => {
    expect(() => activateBoard(collectionOf(first), second.id)).toThrow(
      RangeError,
    );
  });
});

describe('removeBoard', () => {
  test('al eliminar el activo se activa el primero que queda', () => {
    const collection = collectionOf(first, second, third);

    const result = removeBoard(collection, third.id);

    expect(result.boards).toEqual([first, second]);
    expect(activeBoard(result)).toBe(first);
  });

  test('al eliminar otro tablero el activo no cambia', () => {
    const collection = collectionOf(first, second, third);

    const result = removeBoard(collection, first.id);

    expect(result.boards).toEqual([second, third]);
    expect(activeBoard(result)).toBe(third);
  });

  test('al eliminar el último no queda ningún activo', () => {
    const result = removeBoard(collectionOf(first), first.id);

    expect(result).toEqual(EMPTY_COLLECTION);
    expect(activeBoard(result)).toBeNull();
  });

  test('ignora un tablero que no está en la colección', () => {
    const collection = collectionOf(first);

    expect(removeBoard(collection, second.id)).toEqual(collection);
  });

  test('no modifica la colección recibida', () => {
    const collection = collectionOf(first, second);
    const snapshot = structuredClone(collection);

    removeBoard(collection, second.id);

    expect(collection).toEqual(snapshot);
  });
});

describe('replaceBoard', () => {
  test('sustituye el tablero con el mismo id y conserva los demás', () => {
    const collection = collectionOf(first, second);
    const changed = toggleCell(first, 0);

    const result = replaceBoard(collection, changed);

    expect(result.boards).toEqual([changed, second]);
    expect(result.boards[1]).toBe(second);
    expect(activeBoard(result)).toBe(second);
    expect(collection.boards[0]).toBe(first);
  });
});
