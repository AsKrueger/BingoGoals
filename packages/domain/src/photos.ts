import type { BingoBoard } from './types.js';

// Reglas de las fotos de las casillas que comparten la web y la API. La foto
// se guarda aparte del tablero; la casilla solo lleva su identificador.

/** Tipos de foto admitidos. La web siempre guarda JPEG. */
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type PhotoType = (typeof PHOTO_TYPES)[number];

/** Tamaño máximo de una foto ya reducida: 2 MB. */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Identificador de una foto: un UUID, que acaba en la dirección de la API. */
export function isPhotoId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

function startsWith(bytes: Uint8Array, prefix: readonly number[], at = 0) {
  return prefix.every((byte, index) => bytes[at + index] === byte);
}

/**
 * Tipo de una foto según su contenido, no según lo que diga quien la envía,
 * o null si no es ninguno de los admitidos.
 */
export function photoTypeOf(bytes: Uint8Array): PhotoType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  // «RIFF», el tamaño en 4 bytes y «WEBP».
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'image/webp';
  }
  return null;
}

/** Fotos que usan las casillas de un tablero, sin repetir. */
export function photoIdsOf(board: BingoBoard): string[] {
  return [
    ...new Set(
      board.cells.flatMap((cell) => (cell.photoId ? [cell.photoId] : [])),
    ),
  ];
}
