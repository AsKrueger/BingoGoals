import {
  MAX_PHOTO_BYTES,
  photoTypeOf,
  type PhotoType,
} from '@bingogoals/domain';
import type { ParseResult } from '../boards/sync-records.js';

export interface PhotoUpload {
  readonly data: Uint8Array;
  readonly type: PhotoType;
}

/**
 * Valida el cuerpo de `PUT /photos/:id`: el archivo tal cual, sin JSON. El
 * tipo se decide por el contenido, no por la cabecera `Content-Type`.
 */
export function parsePhotoUpload(body: unknown): ParseResult<PhotoUpload> {
  if (!(body instanceof Uint8Array) || body.length === 0) {
    return {
      ok: false,
      message:
        'Falta la foto: envíala tal cual, como image/jpeg, image/png o image/webp.',
    };
  }
  if (body.length > MAX_PHOTO_BYTES) {
    return { ok: false, message: 'La foto ocupa más de 2 MB.' };
  }
  const type = photoTypeOf(body);
  if (!type) {
    return { ok: false, message: 'La foto no es JPEG, PNG ni WebP.' };
  }
  return { ok: true, value: { data: body, type } };
}
