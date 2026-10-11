import type { CSSProperties } from 'react';
import { boardDimension, type BingoBoard } from '../domain';
import styles from './Board.module.css';
import { BoardCell, type BoardMode } from './BoardCell';

interface BoardProps {
  board: BingoBoard;
  mode: BoardMode;
  /** No hace falta en modo de solo lectura. */
  onCellClick?: (index: number) => void;
}

export function Board({ board, mode, onCellClick }: BoardProps) {
  const style = {
    '--board-dimension': boardDimension(board.size),
  } as CSSProperties;

  return (
    <div className={styles.frame}>
      <div
        role="group"
        aria-label="Tablero de bingo"
        className={styles.grid}
        style={style}
      >
        {board.cells.map((cell, index) => (
          <BoardCell
            key={cell.id}
            cell={cell}
            mode={mode}
            onClick={() => onCellClick?.(index)}
          />
        ))}
      </div>
    </div>
  );
}
