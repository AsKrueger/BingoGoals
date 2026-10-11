import { useState } from 'react';
import { Board } from '../components/Board';
import { Celebration } from '../components/Celebration';
import { EditCellDialog } from '../components/EditCellDialog';
import { progress, type BingoBoard } from '../domain';
import { useBoard } from '../hooks/useBoard';
import styles from './BoardScreen.module.css';

interface BoardScreenProps {
  createInitialBoard: () => BingoBoard;
}

export function BoardScreen({ createInitialBoard }: BoardScreenProps) {
  const { board, win, toggle, update, dismissWin } =
    useBoard(createInitialBoard);
  const [isEditing, setIsEditing] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const { completed, total, percentage } = progress(board);
  const editingCell =
    editingIndex === null ? undefined : board.cells[editingIndex];

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>{board.title}</h1>
      </header>

      <main className={styles.main}>
        <section className={styles.progress} aria-label="Progreso">
          <div className={styles.progressHeader}>
            <span>Progreso</span>
            <span className={styles.percentage}>{percentage}%</span>
          </div>
          <div
            className={styles.progressBar}
            role="progressbar"
            aria-label="Progreso del tablero"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={completed}
            aria-valuetext={`${completed} de ${total} conseguidos`}
          >
            <div
              className={styles.progressFill}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <p className={styles.progressText}>
            {completed} de {total} conseguidos
          </p>
        </section>

        <Board
          board={board}
          mode={isEditing ? 'edit' : 'play'}
          onCellClick={isEditing ? setEditingIndex : toggle}
        />

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.editToggle}
            aria-pressed={isEditing}
            onClick={() => setIsEditing(!isEditing)}
          >
            ✏️ Editar casillas
          </button>
          <p className={styles.hint}>
            {isEditing
              ? 'Toca una casilla para editarla.'
              : 'Toca una casilla para marcarla.'}
          </p>
        </div>
      </main>

      {editingIndex !== null && editingCell && (
        <EditCellDialog
          cell={editingCell}
          onCancel={() => setEditingIndex(null)}
          onSave={(changes) => {
            update(editingIndex, changes);
            setEditingIndex(null);
          }}
        />
      )}

      {win !== 'none' && <Celebration win={win} onClose={dismissWin} />}
    </div>
  );
}
