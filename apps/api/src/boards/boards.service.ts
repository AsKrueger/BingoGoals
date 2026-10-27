import { Inject, Injectable } from '@nestjs/common';
import type { BingoBoard } from '@bingogoals/domain';
import type { Board } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { fromBoardRow, toBoardRow } from './board.mapper.js';
import type { BoardRecord } from './sync-records.js';

/**
 * Margen que se resta al cursor de `GET /boards`. Una escritura que empezó
 * justo antes de la consulta puede confirmarse justo después con una hora
 * anterior al cursor; repetir unos segundos es inofensivo, porque aplicar dos
 * veces el mismo tablero no cambia nada.
 */
const CURSOR_MARGIN_MS = 5000;

export interface BoardChanges {
  readonly boards: BoardRecord[];
  /** Lo que el dispositivo debe enviar como `since` la próxima vez. */
  readonly cursor: string;
}

/** Resultado de un cambio: guardado, o rechazado por una versión más reciente. */
export type WriteResult =
  | { readonly status: 'saved' }
  | { readonly status: 'conflict'; readonly current: BoardRecord }
  | { readonly status: 'not-found' };

export function toBoardRecord(row: Board): BoardRecord {
  const { board, archivedAt } = fromBoardRow(row);
  return { board, archivedAt, deletedAt: row.deletedAt?.toISOString() ?? null };
}

/**
 * Texto que representa un valor sin depender del orden de sus claves:
 * PostgreSQL reordena las claves de las columnas JSON al guardarlas.
 */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_, inner: unknown) =>
    inner && typeof inner === 'object' && !Array.isArray(inner)
      ? Object.fromEntries(
          Object.entries(inner).sort(([a], [b]) => a.localeCompare(b)),
        )
      : inner,
  );
}

/** Mismo contenido de tablero, sin contar la hora de servidor. */
function sameBoard(row: Board, board: BingoBoard, archivedAt: string | null) {
  const current = toBoardRecord(row);
  return (
    current.deletedAt === null &&
    current.archivedAt === archivedAt &&
    canonical(current.board) === canonical(board)
  );
}

/**
 * Tableros de cada usuario. Ante dos versiones del mismo tablero gana la de
 * `updatedAt` más reciente; un borrado cuenta como una versión con la fecha
 * de borrado.
 */
@Injectable()
export class BoardsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Tableros cambiados desde `since`, borrados incluidos. */
  async changes(userId: string, since: Date | null): Promise<BoardChanges> {
    const startedAt = Date.now();
    const rows = await this.prisma.board.findMany({
      where: { userId, ...(since && { syncedAt: { gt: since } }) },
      orderBy: { syncedAt: 'asc' },
    });
    return {
      boards: rows.map(toBoardRecord),
      cursor: new Date(startedAt - CURSOR_MARGIN_MS).toISOString(),
    };
  }

  async put(
    userId: string,
    board: BingoBoard,
    archivedAt: string | null,
  ): Promise<WriteResult> {
    const updatedAt = new Date(board.updatedAt);
    const data = toBoardRow({ board, archivedAt }, userId);

    // Solo se sustituye si lo guardado es más antiguo: la condición va en la
    // propia escritura, así que dos peticiones a la vez no se pisan.
    const { count } = await this.prisma.board.updateMany({
      where: { id: board.id, userId, updatedAt: { lt: updatedAt } },
      data: { ...data, deletedAt: null },
    });
    if (count === 1) {
      return { status: 'saved' };
    }

    const existing = await this.prisma.board.findUnique({
      where: { id: board.id },
    });
    if (existing && existing.userId !== userId) {
      return { status: 'not-found' };
    }
    if (existing) {
      // La misma versión enviada dos veces no es un conflicto.
      return sameBoard(existing, board, archivedAt)
        ? { status: 'saved' }
        : { status: 'conflict', current: toBoardRecord(existing) };
    }

    try {
      await this.prisma.board.create({ data });
      return { status: 'saved' };
    } catch (error) {
      // Otro dispositivo lo ha creado a la vez: se vuelve a intentar como
      // cambio, con las mismas reglas.
      if ((error as { code?: unknown }).code === 'P2002') {
        return this.put(userId, board, archivedAt);
      }
      throw error;
    }
  }

  async remove(
    userId: string,
    id: string,
    deletedAt: string,
  ): Promise<WriteResult> {
    const when = new Date(deletedAt);
    const { count } = await this.prisma.board.updateMany({
      where: { id, userId, updatedAt: { lte: when }, deletedAt: null },
      data: { deletedAt: when, updatedAt: when },
    });
    if (count === 1) {
      return { status: 'saved' };
    }

    const existing = await this.prisma.board.findUnique({ where: { id } });
    if (!existing || existing.deletedAt !== null) {
      // No hay nada que borrar, o ya estaba borrado.
      return { status: 'saved' };
    }
    if (existing.userId !== userId) {
      return { status: 'not-found' };
    }
    // Hay un cambio posterior al borrado: gana el cambio.
    return { status: 'conflict', current: toBoardRecord(existing) };
  }
}
