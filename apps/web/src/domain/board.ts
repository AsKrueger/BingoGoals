import type { BingoBoard, BingoCell, BingoSize, BingoStyle } from './types';

export const DEFAULT_STYLE: BingoStyle = {
  theme: 'classic',
  primaryColor: '#6200EE',
  fontFamily: 'Poppins',
};

export type BingoCellChanges = Partial<
  Pick<BingoCell, 'text' | 'icon' | 'imagePath' | 'color'>
>;

export function boardDimension(size: BingoSize): number {
  return size === '3x3' ? 3 : 5;
}

export function createBoard(title: string, size: BingoSize): BingoBoard {
  const total = boardDimension(size) ** 2;
  const center = Math.floor(total / 2);

  const cells = Array.from({ length: total }, (_, index): BingoCell => {
    const isCentralStar = size === '5x5' && index === center;
    return {
      id: crypto.randomUUID(),
      text: isCentralStar ? 'ESTRELLA' : `Objetivo ${index + 1}`,
      isCompleted: isCentralStar,
      icon: null,
      imagePath: null,
      color: null,
      isCentralStar,
    };
  });

  return {
    id: crypto.randomUUID(),
    title,
    size,
    cells,
    style: DEFAULT_STYLE,
    createdAt: new Date().toISOString(),
  };
}

export function toggleCell(board: BingoBoard, index: number): BingoBoard {
  return replaceCell(board, index, (cell) => ({
    ...cell,
    isCompleted: !cell.isCompleted,
  }));
}

export function updateCell(
  board: BingoBoard,
  index: number,
  changes: BingoCellChanges,
): BingoBoard {
  const { text, icon, imagePath, color } = changes;
  return replaceCell(board, index, (cell) => ({
    ...cell,
    ...(text !== undefined && { text }),
    ...(icon !== undefined && { icon }),
    ...(imagePath !== undefined && { imagePath }),
    ...(color !== undefined && { color }),
  }));
}

export function updateStyle(
  board: BingoBoard,
  changes: Partial<BingoStyle>,
): BingoBoard {
  return { ...board, style: { ...board.style, ...changes } };
}

export function renameBoard(board: BingoBoard, title: string): BingoBoard {
  return { ...board, title };
}

/** Desmarca todas las casillas salvo la estrella central; conserva lo demás. */
export function resetBoard(board: BingoBoard): BingoBoard {
  return {
    ...board,
    cells: board.cells.map((cell) => ({
      ...cell,
      isCompleted: cell.isCentralStar,
    })),
  };
}

function replaceCell(
  board: BingoBoard,
  index: number,
  update: (cell: BingoCell) => BingoCell,
): BingoBoard {
  const cell = board.cells[index];
  if (cell === undefined) {
    throw new RangeError(`No existe la casilla ${index} en el tablero.`);
  }
  return { ...board, cells: board.cells.with(index, update(cell)) };
}
