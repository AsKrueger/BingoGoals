import { useState } from 'react';
import { BoardCard } from '../components/BoardCard';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Screen } from '../components/Screen';
import type { ArchivedBoard, BoardHistory } from '@bingogoals/domain';
import { formatDate } from '../format';
import styles from './HistoryScreen.module.css';

interface HistoryScreenProps {
  history: BoardHistory;
  onOpen: (boardId: string) => void;
  onDelete: (boardId: string) => void;
  onBack: () => void;
}

export function HistoryScreen({
  history,
  onOpen,
  onDelete,
  onBack,
}: HistoryScreenProps) {
  const [deleting, setDeleting] = useState<ArchivedBoard | null>(null);

  return (
    <Screen title="Historial" onBack={onBack}>
      {history.length === 0 ? (
        <p className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden="true">
            🕘
          </span>
          Aún no tienes tableros archivados.
        </p>
      ) : (
        <ul className={styles.list}>
          {history.map((entry) => (
            <BoardCard
              key={entry.board.id}
              board={entry.board}
              note={`Archivado el ${formatDate(entry.archivedAt)}`}
              openLabel={`Ver ${entry.board.title}`}
              deleteLabel={`Eliminar ${entry.board.title} del historial`}
              onOpen={() => onOpen(entry.board.id)}
              onDelete={() => setDeleting(entry)}
            />
          ))}
        </ul>
      )}

      {deleting && (
        <ConfirmDialog
          title="¿Eliminar del historial?"
          message={`Se borrará «${deleting.board.title}» del historial y no se podrá recuperar.`}
          confirmLabel="Eliminar"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            onDelete(deleting.board.id);
            setDeleting(null);
          }}
        />
      )}
    </Screen>
  );
}
