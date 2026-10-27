import {
  isBingoBoard,
  isDateString,
  isRecord,
  type BingoBoard,
} from '@bingogoals/domain';
import type { AppData, LocalData, LocalRecord } from './storage';

function isNullableDate(value: unknown): value is string | null {
  return value === null || isDateString(value);
}

/** Comprueba que un registro leído del dispositivo tiene sentido. */
export function isLocalRecord(value: unknown): value is LocalRecord {
  return (
    isRecord(value) &&
    isBingoBoard(value.board) &&
    isNullableDate(value.archivedAt) &&
    isNullableDate(value.deletedAt) &&
    (value.ownerId === null || typeof value.ownerId === 'string') &&
    typeof value.pending === 'boolean'
  );
}

/**
 * Versión de un tablero para decidir cuál gana entre dos: la fecha de su
 * último cambio, o la de su borrado. Al borrar, `updatedAt` se iguala a la
 * fecha de borrado, así que basta con mirar `updatedAt`.
 */
export function recordVersion(record: { readonly board: BingoBoard }): number {
  return Date.parse(record.board.updatedAt);
}

/** Convierte los datos de las versiones 1 y 2 a registros de la versión 3. */
export function fromAppData(data: AppData): LocalData {
  const local = (board: BingoBoard, archivedAt: string | null) => ({
    board,
    archivedAt,
    deletedAt: null,
    ownerId: null,
    pending: false,
  });
  return {
    records: [
      ...data.collection.boards.map((board) => local(board, null)),
      ...data.history.map((entry) => local(entry.board, entry.archivedAt)),
    ],
    activeBoardId: data.collection.activeBoardId,
    syncCursors: {},
  };
}
