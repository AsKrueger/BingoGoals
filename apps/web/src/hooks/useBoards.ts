import { useState } from 'react';
import {
  activateBoard,
  activeBoard,
  addBoard,
  createBoard,
  EMPTY_COLLECTION,
  newWin,
  removeBoard,
  replaceBoard,
  toggleCell,
  updateCell,
  updateStyle,
  type BingoBoard,
  type BingoCellChanges,
  type BingoSize,
  type BingoTheme,
  type BingoWin,
} from '../domain';

/** Guarda los tableros en memoria, cuál está activo y la celebración pendiente. */
export function useBoards() {
  const [collection, setCollection] = useState(EMPTY_COLLECTION);
  const [win, setWin] = useState<BingoWin>('none');
  const board = activeBoard(collection);

  function changeActive(change: (board: BingoBoard) => BingoBoard) {
    if (board) {
      setCollection(replaceBoard(collection, change(board)));
    }
  }

  return {
    boards: collection.boards,
    board,
    win,

    create(title: string, size: BingoSize) {
      setCollection(addBoard(collection, createBoard(title, size)));
      setWin('none');
    },
    remove(boardId: string) {
      setCollection(removeBoard(collection, boardId));
      setWin('none');
    },
    activate(boardId: string) {
      setCollection(activateBoard(collection, boardId));
      setWin('none');
    },

    toggle(index: number) {
      if (board) {
        const after = toggleCell(board, index);
        setCollection(replaceBoard(collection, after));
        setWin(newWin(board, after));
      }
    },
    update(index: number, changes: BingoCellChanges) {
      changeActive((current) => updateCell(current, index, changes));
    },
    setTheme(theme: BingoTheme) {
      changeActive((current) => updateStyle(current, { theme }));
    },
    dismissWin() {
      setWin('none');
    },
  };
}
