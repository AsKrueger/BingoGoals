import { useState } from 'react';
import {
  newWin,
  toggleCell,
  updateCell,
  type BingoBoard,
  type BingoCellChanges,
  type BingoWin,
} from '../domain';

/** Guarda un tablero en memoria y avisa de la celebración pendiente. */
export function useBoard(createInitialBoard: () => BingoBoard) {
  const [board, setBoard] = useState(createInitialBoard);
  const [win, setWin] = useState<BingoWin>('none');

  function toggle(index: number) {
    const after = toggleCell(board, index);
    setBoard(after);
    setWin(newWin(board, after));
  }

  function update(index: number, changes: BingoCellChanges) {
    setBoard(updateCell(board, index, changes));
  }

  function dismissWin() {
    setWin('none');
  }

  return { board, win, toggle, update, dismissWin };
}
