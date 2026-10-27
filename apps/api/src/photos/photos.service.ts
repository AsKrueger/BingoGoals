import { Inject, Injectable } from '@nestjs/common';
import { isPhotoId } from '@bingogoals/domain';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PhotoUpload } from './photo-upload.js';

/**
 * Cuánto se conserva una foto que ninguna casilla usa. Un dispositivo sube
 * las fotos de un tablero justo antes que el tablero: mientras tanto, la foto
 * todavía no la usa nadie y no se debe borrar.
 */
const UNUSED_PHOTO_GRACE = '1 day';

/** Fotos que usan unas casillas guardadas como JSON, sin repetir. */
export function photoIdsInCells(cells: unknown): string[] {
  if (!Array.isArray(cells)) {
    return [];
  }
  const ids = cells
    .map((cell: unknown) => (cell as { photoId?: unknown } | null)?.photoId)
    .filter(isPhotoId);
  return [...new Set(ids)];
}

/**
 * Fotos de cada usuario. Son inmutables: subir dos veces la misma foto no
 * cambia nada, y una foto no se sustituye nunca por otra.
 */
@Injectable()
export class PhotosService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Guarda una foto. Devuelve `taken` si ese identificador ya es de una foto
   * de otro usuario.
   */
  async put(
    userId: string,
    id: string,
    { data, type }: PhotoUpload,
  ): Promise<'saved' | 'taken'> {
    try {
      await this.prisma.photo.create({
        data: { id, userId, type, data: Uint8Array.from(data) },
      });
      return 'saved';
    } catch (error) {
      if ((error as { code?: unknown }).code !== 'P2002') {
        throw error;
      }
      const existing = await this.prisma.photo.findUnique({
        where: { id },
        select: { userId: true },
      });
      // Ya estaba: la misma foto enviada dos veces no es un error.
      return existing?.userId === userId ? 'saved' : 'taken';
    }
  }

  /** Una foto del usuario, o null si no existe o es de otro. */
  async get(
    userId: string,
    id: string,
  ): Promise<{ type: string; data: Uint8Array } | null> {
    const photo = await this.prisma.photo.findUnique({
      where: { id },
      select: { userId: true, type: true, data: true },
    });
    return photo && photo.userId === userId
      ? { type: photo.type, data: photo.data }
      : null;
  }

  /** De esas fotos, las que el usuario todavía no ha subido. */
  async missing(userId: string, ids: readonly string[]): Promise<string[]> {
    if (ids.length === 0) {
      return [];
    }
    const stored = await this.prisma.photo.findMany({
      where: { userId, id: { in: [...ids] } },
      select: { id: true },
    });
    const found = new Set(stored.map((photo) => photo.id));
    return ids.filter((id) => !found.has(id.toLowerCase()));
  }

  /**
   * Borra las fotos del usuario que ya no usa ninguna casilla de sus
   * tableros: las de `released`, que acaban de dejar de usarse, y las que
   * llevan sin usarse más del margen. Devuelve cuántas ha borrado.
   */
  collect(userId: string, released: readonly string[]): Promise<number> {
    return this.prisma.$executeRaw`
      DELETE FROM photos AS photo
      WHERE photo.user_id = ${userId}::uuid
        AND (
          photo.id = ANY(${[...released]}::uuid[])
          OR photo.created_at < now() - ${UNUSED_PHOTO_GRACE}::interval
        )
        AND NOT EXISTS (
          SELECT 1
          FROM boards AS board
          CROSS JOIN LATERAL jsonb_array_elements(board.cells) AS cell
          WHERE board.user_id = photo.user_id
            AND board.deleted_at IS NULL
            AND jsonb_typeof(board.cells) = 'array'
            AND lower(cell ->> 'photoId') = photo.id::text
        )
    `;
  }
}
