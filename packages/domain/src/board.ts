import type { BingoBoard, BingoCell, BingoSize, BingoStyle } from './types.js';
import { isValidTitle } from './validation.js';

export const DEFAULT_STYLE: BingoStyle = {
  theme: 'classic',
};

export type BingoCellChanges = Partial<
  Pick<BingoCell, 'text' | 'icon' | 'photoId' | 'color'>
>;

export function boardDimension(size: BingoSize): number {
  return size === '3x3' ? 3 : 5;
}

export function createBoard(
  title: string,
  size: BingoSize,
  now: Date = new Date(),
): BingoBoard {
  const cleanTitle = checkedTitle(title);
  const total = boardDimension(size) ** 2;
  const center = Math.floor(total / 2);

  const cells = Array.from({ length: total }, (_, index): BingoCell => {
    const isCentralStar = size === '5x5' && index === center;
    return {
      id: crypto.randomUUID(),
      text: isCentralStar ? 'ESTRELLA' : `Objetivo ${index + 1}`,
      isCompleted: isCentralStar,
      icon: null,
      photoId: null,
      color: null,
      isCentralStar,
    };
  });

  const createdAt = now.toISOString();
  return {
    id: crypto.randomUUID(),
    title: cleanTitle,
    size,
    cells,
    style: DEFAULT_STYLE,
    createdAt,
    updatedAt: createdAt,
  };
}

// Todas las funciones que cambian un tablero devuelven uno nuevo con
// `updatedAt` puesto a `now`. La sincronización lo usa para saber qué versión
// de un tablero es la más reciente.

export function toggleCell(
  board: BingoBoard,
  index: number,
  now: Date = new Date(),
): BingoBoard {
  return replaceCell(board, index, now, (cell) => ({
    ...cell,
    isCompleted: !cell.isCompleted,
  }));
}

export function updateCell(
  board: BingoBoard,
  index: number,
  changes: BingoCellChanges,
  now: Date = new Date(),
): BingoBoard {
  const { text, icon, photoId, color } = changes;
  return replaceCell(board, index, now, (cell) => ({
    ...cell,
    ...(text !== undefined && { text }),
    ...(icon !== undefined && { icon }),
    ...(photoId !== undefined && { photoId }),
    ...(color !== undefined && { color }),
  }));
}

export function updateStyle(
  board: BingoBoard,
  changes: Partial<BingoStyle>,
  now: Date = new Date(),
): BingoBoard {
  return touch({ ...board, style: { ...board.style, ...changes } }, now);
}

export function renameBoard(
  board: BingoBoard,
  title: string,
  now: Date = new Date(),
): BingoBoard {
  return touch({ ...board, title: checkedTitle(title) }, now);
}

/** Desmarca todas las casillas salvo la estrella central; conserva lo demás. */
export function resetBoard(
  board: BingoBoard,
  now: Date = new Date(),
): BingoBoard {
  return touch(
    {
      ...board,
      cells: board.cells.map((cell) => ({
        ...cell,
        isCompleted: cell.isCentralStar,
      })),
    },
    now,
  );
}

/** Quita los espacios sobrantes y comprueba que el título sea válido. */
function checkedTitle(title: string): string {
  const clean = title.trim();
  if (!isValidTitle(clean)) {
    throw new RangeError(
      'El título del tablero no puede estar vacío ni tener más de 40 caracteres.',
    );
  }
  return clean;
}

function touch(board: BingoBoard, now: Date): BingoBoard {
  return { ...board, updatedAt: now.toISOString() };
}

function replaceCell(
  board: BingoBoard,
  index: number,
  now: Date,
  update: (cell: BingoCell) => BingoCell,
): BingoBoard {
  const cell = board.cells[index];
  if (cell === undefined) {
    throw new RangeError(`No existe la casilla ${index} en el tablero.`);
  }
  return touch({ ...board, cells: board.cells.with(index, update(cell)) }, now);
}
