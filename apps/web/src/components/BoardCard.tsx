import { boardDimension, progress, type BingoBoard } from '@bingogoals/domain';
import styles from './BoardCard.module.css';
import { ProgressBar } from './ProgressBar';

interface BoardCardProps {
  board: BingoBoard;
  /** Nombre accesible del botón que abre el tablero. */
  openLabel: string;
  deleteLabel: string;
  /** Línea adicional bajo el título, por ejemplo la fecha de archivo. */
  note?: string;
  isActive?: boolean;
  onOpen: () => void;
  onDelete: () => void;
}

/** Tarjeta de un tablero en una lista: resumen, progreso, abrir y eliminar. */
export function BoardCard({
  board,
  openLabel,
  deleteLabel,
  note,
  isActive = false,
  onOpen,
  onDelete,
}: BoardCardProps) {
  const boardProgress = progress(board);
  const dimension = boardDimension(board.size);

  return (
    <li
      className={styles.card}
      data-theme={board.style.theme}
      data-active={isActive}
    >
      <div className={styles.body}>
        <button
          type="button"
          className={styles.open}
          aria-label={openLabel}
          aria-current={isActive ? 'true' : undefined}
          onClick={onOpen}
        >
          <span className={styles.header}>
            <span className={styles.title}>{board.title}</span>
            {isActive && <span className={styles.badge}>Activo</span>}
          </span>
          {note && <span className={styles.details}>{note}</span>}
          <span className={styles.details}>
            {dimension} × {dimension} · {boardProgress.completed} de{' '}
            {boardProgress.total} conseguidos ({boardProgress.percentage} %)
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
        aria-label={deleteLabel}
        title="Eliminar"
        onClick={onDelete}
      >
        <span aria-hidden="true">🗑️</span>
      </button>
    </li>
  );
}
