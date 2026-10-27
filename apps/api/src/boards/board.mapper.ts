import {
  isBingoSize,
  isBingoStyle,
  isCellsFor,
  type BingoBoard,
} from '@bingogoals/domain';
import type { Board, Prisma } from '../generated/prisma/client.js';

/** Un tablero tal como lo entiende el dominio, con su fecha de archivo. */
export interface StoredBoard {
  readonly board: BingoBoard;
  /** Fecha de archivo en formato ISO 8601, o null si el tablero está activo. */
  readonly archivedAt: string | null;
}

/** Convierte un tablero del dominio en la fila que se guarda. */
export function toBoardRow(
  { board, archivedAt }: StoredBoard,
  userId: string,
): Prisma.BoardUncheckedCreateInput {
  return {
    id: board.id,
    userId,
    title: board.title,
    size: board.size,
    style: { ...board.style },
    cells: board.cells.map((cell) => ({ ...cell })),
    createdAt: new Date(board.createdAt),
    updatedAt: new Date(board.updatedAt),
    archivedAt: archivedAt === null ? null : new Date(archivedAt),
  };
}

/**
 * Convierte una fila en un tablero del dominio. Las columnas JSON pueden
 * contener cualquier cosa, así que se validan con las reglas del dominio
 * compartido; una fila que no las cumple lanza un error.
 */
export function fromBoardRow(row: Board): StoredBoard {
  const { size, style, cells } = row;
  if (!isBingoSize(size) || !isBingoStyle(style) || !isCellsFor(size, cells)) {
    throw new Error(`El tablero ${row.id} guardado no es válido.`);
  }

  return {
    board: {
      id: row.id,
      title: row.title,
      size,
      style,
      cells,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    },
    archivedAt: row.archivedAt?.toISOString() ?? null,
  };
}
