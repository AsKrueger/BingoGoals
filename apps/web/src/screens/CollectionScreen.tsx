import { useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ProgressBar } from '../components/ProgressBar';
import { Screen } from '../components/Screen';
import { boardDimension, progress, type BingoBoard } from '../domain';
import styles from './CollectionScreen.module.css';

interface CollectionScreenProps {
  boards: readonly BingoBoard[];
  activeBoardId: string;
  onOpen: (boardId: string) => void;
  onDelete: (boardId: string) => void;
  onCreate: () => void;
  onBack: () => void;
}

export function CollectionScreen({
  boards,
  activeBoardId,
  onOpen,
  onDelete,
  onCreate,
  onBack,
}: CollectionScreenProps) {
  const [deleting, setDeleting] = useState<BingoBoard | null>(null);

  return (
    <Screen title="Mis tableros" onBack={onBack} backLabel="Volver al tablero">
      <ul className={styles.list}>
        {boards.map((board) => {
          const boardProgress = progress(board);
          const dimension = boardDimension(board.size);
          const isActive = board.id === activeBoardId;

          return (
            <li
              key={board.id}
              className={styles.card}
              data-theme={board.style.theme}
              data-active={isActive}
            >
              <div className={styles.cardBody}>
                <button
                  type="button"
                  className={styles.open}
                  aria-label={`Abrir ${board.title}`}
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => onOpen(board.id)}
                >
                  <span className={styles.cardHeader}>
                    <span className={styles.cardTitle}>{board.title}</span>
                    {isActive && <span className={styles.badge}>Activo</span>}
                  </span>
                  <span className={styles.details}>
                    {dimension} × {dimension} · {boardProgress.completed} de{' '}
                    {boardProgress.total} conseguidos
                  </span>
                </button>
                <ProgressBar
                  label={`Progreso de ${board.title}`}
                  progress={boardProgress}
                />
              </div>
              <button
                type="button"
                className={styles.delete}
                aria-label={`Eliminar ${board.title}`}
                title="Eliminar"
                onClick={() => setDeleting(board)}
              >
                <span aria-hidden="true">🗑️</span>
              </button>
            </li>
          );
        })}
      </ul>

      <button type="button" className={styles.create} onClick={onCreate}>
        + Nuevo tablero
      </button>

      {deleting && (
        <ConfirmDialog
          title="¿Eliminar tablero?"
          message={`Se borrará «${deleting.title}» y no se podrá recuperar.`}
          confirmLabel="Eliminar"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            onDelete(deleting.id);
            setDeleting(null);
          }}
        />
      )}
    </Screen>
  );
}
