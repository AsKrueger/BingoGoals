import {
  isArrayOf,
  isBingoBoard,
  isDateString,
  isRecord,
  type ArchivedBoard,
  type BoardCollection,
} from '@bingogoals/domain';
import { migrateStoredData } from './migrations';
import type { AppData, LoadResult } from './storage';

/**
 * Versión del formato de los datos guardados. Al cambiar el formato, súbela y
 * añade en migrations.ts el paso desde la versión anterior.
 *
 * - 1: formato inicial.
 * - 2: el estilo solo guarda el tema y cada tablero lleva `updatedAt`.
 */
export const STORAGE_VERSION = 2;

export interface StoredData extends AppData {
  readonly version: number;
}

export function toStoredData(data: AppData): StoredData {
  return { version: STORAGE_VERSION, ...data };
}

/**
 * Valida un registro con el formato de la versión actual. Devuelve null si
 * está corrupto o es de otra versión.
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

/** true si el registro es de una versión anterior que hay que migrar. */
export function isOlderVersion(raw: unknown): boolean {
  return (
    isRecord(raw) &&
    typeof raw.version === 'number' &&
    raw.version < STORAGE_VERSION
  );
}

/**
 * Clasifica el registro leído del dispositivo, migrándolo antes si es de una
 * versión anterior. Que no haya registro (primera visita) no es lo mismo que
 * haya uno que no se sabe leer.
 */
export function readStoredData(raw: unknown): LoadResult {
  if (raw === undefined) {
    return { status: 'empty' };
  }
  const data = parseStoredData(migrateStoredData(raw));
  return data ? { status: 'loaded', data } : { status: 'unreadable' };
}

function isCollection(value: unknown): value is BoardCollection {
  if (!isRecord(value) || !isArrayOf(value.boards, isBingoBoard)) {
    return false;
  }
  const { boards, activeBoardId } = value;
  // Sin tableros no hay activo; con tableros, el activo tiene que existir.
  return boards.length === 0
    ? activeBoardId === null
    : boards.some((board) => board.id === activeBoardId);
}

function isArchivedBoard(value: unknown): value is ArchivedBoard {
  return (
    isRecord(value) &&
    isBingoBoard(value.board) &&
    isDateString(value.archivedAt)
  );
}
