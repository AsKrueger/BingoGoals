export const BINGO_SIZES = ['3x3', '5x5'] as const;
export type BingoSize = (typeof BINGO_SIZES)[number];

export const BINGO_THEMES = [
  'classic',
  'christmas',
  'sakura',
  'spring',
  'newYear',
  'birthday',
] as const;
export type BingoTheme = (typeof BINGO_THEMES)[number];

export interface BingoCell {
  readonly id: string;
  readonly text: string;
  readonly isCompleted: boolean;
  readonly icon: string | null;
  /** Foto de la casilla, guardada aparte del tablero, o null. */
  readonly photoId: string | null;
  readonly color: string | null;
  readonly isCentralStar: boolean;
}

export interface BingoStyle {
  readonly theme: BingoTheme;
}

export interface BingoBoard {
  readonly id: string;
  readonly title: string;
  readonly size: BingoSize;
  readonly cells: readonly BingoCell[];
  readonly style: BingoStyle;
  /** Fecha de creación en formato ISO 8601. */
  readonly createdAt: string;
  /** Fecha del último cambio en formato ISO 8601. */
  readonly updatedAt: string;
}

export type BingoLineType = 'row' | 'column' | 'diagonal';

export interface BingoLine {
  readonly type: BingoLineType;
  /** Fila o columna empezando en 0. En diagonales, 0 es la principal y 1 la secundaria. */
  readonly index: number;
  /** Posiciones de las casillas de la línea dentro de `board.cells`. */
  readonly cells: readonly number[];
}

export type BingoWin = 'none' | 'line' | 'bingo';

export interface BingoProgress {
  readonly completed: number;
  readonly total: number;
  /** Entero entre 0 y 100. */
  readonly percentage: number;
}
