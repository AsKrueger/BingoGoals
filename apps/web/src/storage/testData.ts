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
import type { AppData } from './storage';

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
    imagePath: 'data:image/jpeg;base64,AAAA',
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
