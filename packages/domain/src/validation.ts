import { boardDimension } from './board.js';
import { isPhotoId } from './photos.js';
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

/** Longitud máxima del título de un tablero. */
export const MAX_TITLE_LENGTH = 40;

/**
 * Título válido para un tablero: texto sin espacios sobrantes alrededor, no
 * vacío y de ${MAX_TITLE_LENGTH} caracteres como mucho.
 */
export function isValidTitle(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value !== '' &&
    value === value.trim() &&
    value.length <= MAX_TITLE_LENGTH
  );
}

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
 * La casilla solo guarda el identificador de su foto: la foto va aparte. Se
 * exige un UUID porque acaba en la dirección de la API.
 */
function isNullablePhotoId(value: unknown): value is string | null {
  return value === null || isPhotoId(value);
}

export function isBingoCell(value: unknown): value is BingoCell {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.text === 'string' &&
    typeof value.isCompleted === 'boolean' &&
    typeof value.isCentralStar === 'boolean' &&
    isNullableString(value.icon) &&
    isNullablePhotoId(value.photoId) &&
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
