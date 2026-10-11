import { useState } from 'react';
import {
  activateBoard,
  activeBoard,
  addBoard,
  archiveBoard,
  createBoard,
  EMPTY_COLLECTION,
  EMPTY_HISTORY,
  newWin,
  removeBoard,
  removeFromHistory,
  renameBoard,
  replaceBoard,
  resetBoard,
  toggleCell,
  updateCell,
  updateStyle,
  type BingoBoard,
  type BingoCellChanges,
  type BingoSize,
  type BingoTheme,
  type BingoWin,
} from '../domain';

/**
 * Guarda en memoria los tableros, cuál está activo, el historial de
 * archivados y la celebración pendiente.
 */
export function useBoards() {
  const [collection, setCollection] = useState(EMPTY_COLLECTION);
  const [history, setHistory] = useState(EMPTY_HISTORY);
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
    history,
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
    rename(title: string) {
      changeActive((current) => renameBoard(current, title));
    },
    reset() {
      changeActive(resetBoard);
      setWin('none');
    },
    dismissWin() {
      setWin('none');
    },

    /** Mueve el tablero activo de la colección al historial. */
    archive() {
      if (board) {
        setHistory(archiveBoard(history, board));
        setCollection(removeBoard(collection, board.id));
        setWin('none');
      }
    },
    removeArchived(boardId: string) {
      setHistory(removeFromHistory(history, boardId));
    },
  };
}
