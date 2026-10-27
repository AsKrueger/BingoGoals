import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CurrentSession } from '../auth/auth.guard.js';
import type { ActiveSession } from '../auth/auth.service.js';
import {
  BoardsService,
  type BoardChanges,
  type WriteResult,
} from './boards.service.js';
import {
  parseBoardUpload,
  parseDeletion,
  parseSince,
  type ParseResult,
} from './sync-records.js';

function valid<T>(result: ParseResult<T>): T {
  if (!result.ok) {
    throw new BadRequestException({ message: result.message });
  }
  return result.value;
}

/** Traduce el resultado de una escritura a la respuesta HTTP. */
function respond(result: WriteResult): { missingPhotos: string[] } {
  if (result.status === 'not-found') {
    // Un tablero de otro usuario se trata como si no existiera.
    throw new NotFoundException({ message: 'El tablero no existe.' });
  }
  if (result.status === 'conflict') {
    throw new ConflictException({
      message: 'Hay una versión más reciente de este tablero.',
      current: result.current,
    });
  }
  return { missingPhotos: result.missingPhotos };
}

/**
 * Tableros de la cuenta. Cada usuario solo ve y cambia los suyos. La
 * sincronización trabaja con el tablero completo.
 */
@Controller('boards')
@UseGuards(AuthGuard)
export class BoardsController {
  constructor(@Inject(BoardsService) private readonly boards: BoardsService) {}

  /** Tableros cambiados desde `since`, borrados incluidos. */
  @Get()
  list(
    @CurrentSession() session: ActiveSession,
    @Query('since') since: unknown,
  ): Promise<BoardChanges> {
    return this.boards.changes(session.user.id, valid(parseSince(since)));
  }

  /**
   * Crea o sustituye un tablero. Responde con las fotos de sus casillas que
   * el servidor no tiene, para que el dispositivo las suba, o 409 con la
   * versión guardada si esa es más reciente.
   */
  @Put(':id')
  @HttpCode(200)
  async put(
    @CurrentSession() session: ActiveSession,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ): Promise<{ missingPhotos: string[] }> {
    const { board, archivedAt } = valid(parseBoardUpload(id, body));
    return respond(await this.boards.put(session.user.id, board, archivedAt));
  }

  /**
   * Borra un tablero, de forma lógica. Responde 409 con la versión guardada
   * si tiene un cambio posterior al borrado.
   */
  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentSession() session: ActiveSession,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('deletedAt') deletedAt: unknown,
  ): Promise<void> {
    respond(
      await this.boards.remove(
        session.user.id,
        id,
        valid(parseDeletion(deletedAt)),
      ),
    );
  }
}
