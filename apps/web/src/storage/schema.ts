import {
  isArrayOf,
  isBingoBoard,
  isDateString,
  isRecord,
  type ArchivedBoard,
  type BoardCollection,
} from '@bingogoals/domain';
import { migrateStoredData } from './migrations';
import { createPhotoExtraction } from './photoMigration';
import type { AppData, StoredPhoto } from './storage';

// Formato de las versiones 1 y 2: todos los datos en un único registro. La
// versión 3 guarda un registro por tablero y la 4, las fotos aparte (ver
// storage.ts); esto solo sirve para leer lo guardado antes y migrarlo.
//
// Al leerlo, las fotos incrustadas en las casillas (`imagePath`) se sacan
// aparte, así que lo que se valida ya lleva `photoId`, como en la versión 4.

/**
 * Última versión del formato de un único registro.
 *
 * - 1: formato inicial.
 * - 2: el estilo solo guarda el tema y cada tablero lleva `updatedAt`.
 */
export const RECORD_VERSION = 2;

/** Resultado de leer el registro único de las versiones 1 y 2. */
export type LegacyReadResult =
  | { readonly status: 'empty' }
  | {
      readonly status: 'loaded';
      readonly data: AppData;
      /** Las fotos que iban incrustadas en las casillas. */
      readonly photos: StoredPhoto[];
    }
  | { readonly status: 'unreadable' };

export interface StoredData extends AppData {
  readonly version: number;
}

export function toStoredData(data: AppData): StoredData {
  return { version: RECORD_VERSION, ...data };
}

/**
 * Valida un registro con el formato de la versión actual. Devuelve null si
 * está corrupto o es de otra versión.
 */
export function parseStoredData(raw: unknown): AppData | null {
  if (!isRecord(raw) || raw.version !== RECORD_VERSION) {
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
    raw.version < RECORD_VERSION
  );
}

/**
 * Clasifica el registro leído del dispositivo, migrándolo antes si es de una
 * versión anterior. Que no haya registro (primera visita) no es lo mismo que
 * haya uno que no se sabe leer.
 */
export function readLegacyRecord(
  raw: unknown,
  now: Date = new Date(),
): LegacyReadResult {
  if (raw === undefined) {
    return { status: 'empty' };
  }
  const extraction = createPhotoExtraction(now);
  const data = parseStoredData(
    mapBoards(migrateStoredData(raw), extraction.board),
  );
  return data
    ? { status: 'loaded', data, photos: extraction.photos }
    : { status: 'unreadable' };
}

/** Aplica `change` a cada tablero de un registro sin validar. */
function mapBoards(raw: unknown, change: (board: unknown) => unknown): unknown {
  if (!isRecord(raw)) {
    return raw;
  }
  const { collection, history } = raw;
  return {
    ...raw,
    collection:
      isRecord(collection) && Array.isArray(collection.boards)
        ? { ...collection, boards: collection.boards.map(change) }
        : collection,
    history: Array.isArray(history)
      ? history.map((entry: unknown) =>
          isRecord(entry) ? { ...entry, board: change(entry.board) } : entry,
        )
      : history,
  };
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
