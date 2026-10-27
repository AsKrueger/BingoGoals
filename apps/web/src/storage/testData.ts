import {
  addBoard,
  archiveBoard,
  createBoard,
  EMPTY_COLLECTION,
  EMPTY_HISTORY,
  toggleCell,
  updateCell,
  updateStyle,
} from '@bingogoals/domain';
import { toStoredData } from './schema';
import type { AppData } from './storage';

/** Foto de la primera casilla de los datos de ejemplo. */
export const SAMPLE_PHOTO_ID = '0b7c8f3e-5a2d-4c1b-9e6f-1a2b3c4d5e6f';

/** Un JPEG mínimo: basta con su cabecera para que se reconozca. */
export const SAMPLE_JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);

/** El mismo JPEG, incrustado como se guardaba hasta la versión 3. */
export const SAMPLE_JPEG_DATA_URL = 'data:image/jpeg;base64,/9j/4AAQ';

/**
 * Datos de ejemplo para los tests: dos tableros con casillas personalizadas
 * (texto, icono, color, foto y tema) y uno archivado.
 */
export function sampleData(): AppData {
  let first = createBoard('Primero', '3x3');
  first = updateCell(first, 0, {
    text: 'Correr 10 km',
    icon: '🏋️',
    color: '#2196F3',
    photoId: SAMPLE_PHOTO_ID,
  });
  first = toggleCell(first, 0);
  first = updateStyle(first, { theme: 'sakura' });

  const second = toggleCell(createBoard('Segundo', '5x5'), 3);
  const archived = toggleCell(createBoard('Archivado', '3x3'), 4);

  return {
    collection: addBoard(addBoard(EMPTY_COLLECTION, first), second),
    history: archiveBoard(
      EMPTY_HISTORY,
      archived,
      new Date('2026-10-05T10:00:00.000Z'),
    ),
  };
}

/**
 * Unos datos como los guardaba la versión 2, en un único registro y con las
 * fotos incrustadas en las casillas (`imagePath`).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function legacyStoredData(data: AppData = sampleData()): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const embed = (board: any) => ({
    ...board,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cells: board.cells.map(({ photoId, ...cell }: any) => ({
      ...cell,
      imagePath: photoId ? SAMPLE_JPEG_DATA_URL : null,
    })),
  });
  const stored = structuredClone(toStoredData(data));
  return {
    ...stored,
    collection: {
      ...stored.collection,
      boards: stored.collection.boards.map(embed),
    },
    history: stored.history.map((entry) => ({
      ...entry,
      board: embed(entry.board),
    })),
  };
}

/** Un tablero sin el identificador de la foto, que cambia al migrar. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withoutPhotoIds(board: any) {
  return {
    ...board,
    cells: board.cells.map((cell: object) => {
      const copy: Record<string, unknown> = { ...cell };
      delete copy.photoId;
      delete copy.imagePath;
      return copy;
    }),
  };
}
