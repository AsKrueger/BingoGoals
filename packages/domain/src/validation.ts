import { boardDimension } from './board.js';
import {
  BINGO_SIZES,
  BINGO_THEMES,
  type BingoBoard,
  type BingoCell,
  type BingoSize,
  type BingoStyle,
  type BingoTheme,
} from './types.js';

// Comprobaciones de que un valor de origen desconocido (leído del
// dispositivo, de la base de datos o recibido por la API) tiene la forma de
// un tablero. La web y la API usan las mismas.

type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isArrayOf<T>(
  value: unknown,
  isItem: (item: unknown) => item is T,
): value is T[] {
  return Array.isArray(value) && value.every(isItem);
}

/** Fecha en formato de texto que `Date` sabe leer, como ISO 8601. */
export function isDateString(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

/**
 * Las fotos se guardan como URL de datos de imagen. No se admite otra cosa:
 * este valor acaba en un `url()` de CSS, y una dirección externa o un texto
 * manipulado no deben llegar ahí.
 */
const IMAGE_DATA_URL =
  /^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+=*$/;

function isNullableImage(value: unknown): value is string | null {
  return (
    value === null || (typeof value === 'string' && IMAGE_DATA_URL.test(value))
  );
}

export function isBingoCell(value: unknown): value is BingoCell {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.text === 'string' &&
    typeof value.isCompleted === 'boolean' &&
    typeof value.isCentralStar === 'boolean' &&
    isNullableString(value.icon) &&
    isNullableImage(value.imagePath) &&
    isNullableString(value.color)
  );
}

export function isBingoStyle(value: unknown): value is BingoStyle {
  return isRecord(value) && BINGO_THEMES.includes(value.theme as BingoTheme);
}

export function isBingoSize(value: unknown): value is BingoSize {
  return BINGO_SIZES.includes(value as BingoSize);
}

/** Lista de casillas con el número exacto que pide el tamaño del tablero. */
export function isCellsFor(
  size: BingoSize,
  value: unknown,
): value is BingoCell[] {
  return (
    isArrayOf(value, isBingoCell) && value.length === boardDimension(size) ** 2
  );
}

export function isBingoBoard(value: unknown): value is BingoBoard {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    isBingoSize(value.size) &&
    isBingoStyle(value.style) &&
    isDateString(value.createdAt) &&
    isDateString(value.updatedAt) &&
    isCellsFor(value.size, value.cells)
  );
}
