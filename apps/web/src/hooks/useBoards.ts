import { useState, useSyncExternalStore } from 'react';
import {
  activateBoard,
  activeBoard,
  addBoard,
  archiveBoard,
  createBoard,
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
} from '@bingogoals/domain';
import type { BoardStore } from '../store/boardStore';
import type { AppData } from '../storage/storage';

/** Aplica un cambio al tablero activo, si lo hay. */
function changeActive(change: (board: BingoBoard) => BingoBoard) {
  return (data: AppData): AppData => {
    const current = activeBoard(data.collection);
    return current
      ? { ...data, collection: replaceBoard(data.collection, change(current)) }
      : data;
  };
}

/**
 * Los tableros que muestran las pantallas y las acciones sobre ellos. El
 * estado vive en el almacén de tableros; aquí solo se lee y se pide cambiar.
 * Cada cambio parte del estado más reciente del almacén, no del último render.
 */
export function useBoards(store: BoardStore) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [win, setWin] = useState<BingoWin>('none');
  const { collection, history } = snapshot.data;

  return {
    boards: collection.boards,
    board: activeBoard(collection),
    history,
    win,
    saveError: snapshot.saveError,
    retrySave: store.retrySave,

    create(title: string, size: BingoSize) {
      store.update((data) => ({
        ...data,
        collection: addBoard(data.collection, createBoard(title, size)),
      }));
      setWin('none');
    },
    remove(boardId: string) {
      store.update((data) => ({
        ...data,
        collection: removeBoard(data.collection, boardId),
      }));
      setWin('none');
    },
    activate(boardId: string) {
      store.update((data) => ({
        ...data,
        collection: activateBoard(data.collection, boardId),
      }));
      setWin('none');
    },

    toggle(index: number) {
      const before = activeBoard(store.getSnapshot().data.collection);
      if (!before) {
        return;
      }
      const after = toggleCell(before, index);
      store.update((data) => ({
        ...data,
        collection: replaceBoard(data.collection, after),
      }));
      setWin(newWin(before, after));
    },
    update(index: number, changes: BingoCellChanges) {
      store.update(changeActive((board) => updateCell(board, index, changes)));
    },
    setTheme(theme: BingoTheme) {
      store.update(changeActive((board) => updateStyle(board, { theme })));
    },
    rename(title: string) {
      store.update(changeActive((board) => renameBoard(board, title)));
    },
    reset() {
      store.update(changeActive(resetBoard));
      setWin('none');
    },
    dismissWin() {
      setWin('none');
    },

    /** Mueve el tablero activo de la colección al historial. */
    archive() {
      store.update((data) => {
        const current = activeBoard(data.collection);
        return current
          ? {
              collection: removeBoard(data.collection, current.id),
              history: archiveBoard(data.history, current),
            }
          : data;
      });
      setWin('none');
    },
    removeArchived(boardId: string) {
      store.update((data) => ({
        ...data,
        history: removeFromHistory(data.history, boardId),
      }));
    },
  };
}
