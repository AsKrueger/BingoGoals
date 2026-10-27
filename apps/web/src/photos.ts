import type { NewPhoto } from './store/photoStore';

/** Lado máximo, en píxeles, de una foto guardada. */
export const MAX_PHOTO_SIDE = 1024;

/** Tamaño máximo del archivo elegido, antes de reducirlo: 20 MB. */
export const MAX_CHOSEN_PHOTO_BYTES = 20 * 1024 * 1024;

const JPEG_QUALITY = 0.85;

interface Size {
  width: number;
  height: number;
}

/** Tamaño que cabe en `maxSide` conservando la proporción. Nunca amplía. */
export function fitWithin(size: Size, maxSide: number): Size {
  const scale = Math.min(1, maxSide / Math.max(size.width, size.height));
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

/**
 * Reduce una foto en el propio dispositivo y la devuelve como archivo JPEG,
 * para que guardarla y subirla no agote el espacio ni los datos. Rechaza si
 * el archivo no es una imagen que el navegador sepa leer.
 */
export async function resizePhoto(
  file: Blob,
  maxSide: number = MAX_PHOTO_SIDE,
): Promise<NewPhoto> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = fitWithin(bitmap, maxSide);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('No se puede dibujar la foto.');
    }
    // JPEG no tiene transparencia: sin esto, el fondo saldría negro.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    const jpeg = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    );
    if (!jpeg) {
      throw new Error('No se puede guardar la foto.');
    }
    return { type: 'image/jpeg', bytes: await jpeg.arrayBuffer() };
  } finally {
    bitmap.close();
  }
}
