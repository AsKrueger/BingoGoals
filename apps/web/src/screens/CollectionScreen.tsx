import { useState } from 'react';
import { BoardCard } from '../components/BoardCard';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { HeaderButton, Screen } from '../components/Screen';
import type { BingoBoard } from '../domain';
import styles from './CollectionScreen.module.css';

interface CollectionScreenProps {
  boards: readonly BingoBoard[];
  activeBoardId: string;
  onOpen: (boardId: string) => void;
  onDelete: (boardId: string) => void;
  onCreate: () => void;
  onOpenHistory: () => void;
  onBack: () => void;
}

export function CollectionScreen({
  boards,
  activeBoardId,
  onOpen,
  onDelete,
  onCreate,
  onOpenHistory,
  onBack,
}: CollectionScreenProps) {
  const [deleting, setDeleting] = useState<BingoBoard | null>(null);

  return (
    <Screen
      title="Mis tableros"
      onBack={onBack}
      backLabel="Volver al tablero"
      actions={
        <HeaderButton label="Historial" icon="🕘" onClick={onOpenHistory} />
      }
    >
      <ul className={styles.list}>
        {boards.map((board) => (
          <BoardCard
            key={board.id}
            board={board}
            openLabel={`Abrir ${board.title}`}
            deleteLabel={`Eliminar ${board.title}`}
            isActive={board.id === activeBoardId}
            onOpen={() => onOpen(board.id)}
            onDelete={() => setDeleting(board)}
          />
        ))}
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
