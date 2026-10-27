import { isRecord, PHOTO_TYPES, type PhotoType } from '@bingogoals/domain';
import type { StoredPhoto } from './storage';

// Hasta la versión 3, la foto de una casilla iba incrustada en el tablero,
// como URL de datos en `imagePath`. Desde la versión 4 se guarda aparte y la
// casilla solo lleva su identificador, en `photoId`.

const DATA_URL = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/]+=*)$/;

/**
 * El archivo de una URL de datos, o null si no es una foto admitida. Se fía
 * del tipo que declara: estas fotos las creó la propia web. Al subirla, la
 * API comprobará su contenido.
 */
function decode(dataUrl: unknown): Pick<StoredPhoto, 'type' | 'bytes'> | null {
  const [, type, base64] =
    (typeof dataUrl === 'string' && DATA_URL.exec(dataUrl)) || [];
  if (!base64 || !PHOTO_TYPES.includes(type as PhotoType)) {
    return null;
  }
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return { type: type as PhotoType, bytes: bytes.buffer };
}

/**
 * Saca las fotos incrustadas de los tableros a medida que se migran. Trabaja
 * sobre datos sin validar: lo que no tenga forma de tablero se deja como
 * está, y una foto que no se puede leer se quita de su casilla.
 */
export interface PhotoExtraction {
  /** Las fotos sacadas hasta ahora, listas para guardar. */
  readonly photos: StoredPhoto[];
  /** El tablero con `photoId` en sus casillas en lugar de `imagePath`. */
  board(raw: unknown): unknown;
}

export function createPhotoExtraction(now: Date = new Date()): PhotoExtraction {
  const photos: StoredPhoto[] = [];

  function cell(raw: unknown): unknown {
    if (!isRecord(raw) || !('imagePath' in raw)) {
      return raw;
    }
    const { imagePath, ...rest } = raw;
    const file = decode(imagePath);
    if (!file) {
      return { ...rest, photoId: null };
    }
    const id = crypto.randomUUID();
    photos.push({
      id,
      ...file,
      savedAt: now.toISOString(),
      uploadedBy: null,
    });
    return { ...rest, photoId: id };
  }

  return {
    photos,
    board(raw) {
      return isRecord(raw) && Array.isArray(raw.cells)
        ? { ...raw, cells: raw.cells.map(cell) }
        : raw;
    },
  };
}
