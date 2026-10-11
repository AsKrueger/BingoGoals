import { Board } from '../components/Board';
import { ProgressBar } from '../components/ProgressBar';
import { Screen } from '../components/Screen';
import { progress, type ArchivedBoard } from '../domain';
import { formatDate } from '../format';
import styles from './HistoryDetailScreen.module.css';

interface HistoryDetailScreenProps {
  entry: ArchivedBoard;
  onBack: () => void;
}

/** Tablero archivado, de solo lectura: ni se marca ni se edita. */
export function HistoryDetailScreen({
  entry,
  onBack,
}: HistoryDetailScreenProps) {
  const { board, archivedAt } = entry;
  const boardProgress = progress(board);

  return (
    <Screen
      title={board.title}
      theme={board.style.theme}
      onBack={onBack}
      backLabel="Volver al historial"
    >
      <section className={styles.summary} aria-label="Resumen">
        <p className={styles.archived}>
          <span aria-hidden="true">🔒</span> Archivado el{' '}
          {formatDate(archivedAt)} · Solo lectura
        </p>
        <ProgressBar label="Progreso final" progress={boardProgress} />
        <p className={styles.progressText}>
          {boardProgress.completed} de {boardProgress.total} conseguidos (
          {boardProgress.percentage} %)
        </p>
      </section>

      <Board board={board} mode="readonly" />
    </Screen>
  );
}
