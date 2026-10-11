import {
  BINGO_SIZES,
  BINGO_THEMES,
  boardDimension,
  type ArchivedBoard,
  type BingoBoard,
  type BingoCell,
  type BingoSize,
  type BingoStyle,
  type BingoTheme,
  type BoardCollection,
} from '../domain';
import type { AppData } from './storage';

/**
 * Versión del formato de los datos guardados. Súbela cuando cambie el formato
 * y añade aquí la migración desde la versión anterior.
 */
export const STORAGE_VERSION = 1;

export interface StoredData extends AppData {
  readonly version: number;
}

export function toStoredData(data: AppData): StoredData {
  return { version: STORAGE_VERSION, ...data };
}

/**
 * Valida lo leído del dispositivo. Devuelve null si está corrupto o es de una
 * versión desconocida, para que la web arranque vacía en lugar de fallar.
 */
export function parseStoredData(raw: unknown): AppData | null {
  if (!isRecord(raw) || raw.version !== STORAGE_VERSION) {
    return null;
  }
  const { collection, history } = raw;
  if (!isCollection(collection) || !isArrayOf(history, isArchivedBoard)) {
    return null;
  }
  return { collection, history };
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isArrayOf<T>(
  value: unknown,
  isItem: (item: unknown) => item is T,
): value is T[] {
  return Array.isArray(value) && value.every(isItem);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isCell(value: unknown): value is BingoCell {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.text === 'string' &&
    typeof value.isCompleted === 'boolean' &&
    typeof value.isCentralStar === 'boolean' &&
    isNullableString(value.icon) &&
    isNullableString(value.imagePath) &&
    isNullableString(value.color)
  );
}

function isStyle(value: unknown): value is BingoStyle {
  return (
    isRecord(value) &&
    BINGO_THEMES.includes(value.theme as BingoTheme) &&
    typeof value.primaryColor === 'string' &&
    typeof value.fontFamily === 'string'
  );
}

function isBoard(value: unknown): value is BingoBoard {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    !BINGO_SIZES.includes(value.size as BingoSize) ||
    !isStyle(value.style) ||
    !isDate(value.createdAt) ||
    !isArrayOf(value.cells, isCell)
  ) {
    return false;
  }
  return value.cells.length === boardDimension(value.size as BingoSize) ** 2;
}

function isCollection(value: unknown): value is BoardCollection {
  if (!isRecord(value) || !isArrayOf(value.boards, isBoard)) {
    return false;
  }
  const { boards, activeBoardId } = value;
  // Sin tableros no hay activo; con tableros, el activo tiene que existir.
  return boards.length === 0
    ? activeBoardId === null
    : boards.some((board) => board.id === activeBoardId);
}

function isArchivedBoard(value: unknown): value is ArchivedBoard {
  return isRecord(value) && isBoard(value.board) && isDate(value.archivedAt);
}
