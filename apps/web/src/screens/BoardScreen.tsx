import { useState } from 'react';
import { Board } from '../components/Board';
import { Celebration } from '../components/Celebration';
import { EditCellDialog } from '../components/EditCellDialog';
import { ProgressBar } from '../components/ProgressBar';
import { HeaderButton, Screen } from '../components/Screen';
import { ThemeDialog } from '../components/ThemeDialog';
import {
  progress,
  type BingoBoard,
  type BingoCellChanges,
  type BingoTheme,
  type BingoWin,
} from '@bingogoals/domain';
import { THEMES } from '../themes';
import styles from './BoardScreen.module.css';
import { Button } from '../components/Button';

export type BoardSection =
  'collection' | 'stats' | 'settings' | 'history' | 'account';

interface BoardScreenProps {
  board: BingoBoard;
  win: BingoWin;
  onToggle: (index: number) => void;
  onUpdate: (index: number, changes: BingoCellChanges) => void;
  onThemeChange: (theme: BingoTheme) => void;
  onDismissWin: () => void;
  onOpen: (section: BoardSection) => void;
}

const SECTIONS: { section: BoardSection; label: string; icon: string }[] = [
  { section: 'collection', label: 'Mis tableros', icon: '🗂️' },
  { section: 'stats', label: 'Estadísticas', icon: '📊' },
  { section: 'settings', label: 'Ajustes', icon: '⚙️' },
  { section: 'history', label: 'Historial', icon: '🕘' },
  { section: 'account', label: 'Cuenta', icon: '👤' },
];

export function BoardScreen({
  board,
  win,
  onToggle,
  onUpdate,
  onThemeChange,
  onDismissWin,
  onOpen,
}: BoardScreenProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isChoosingTheme, setIsChoosingTheme] = useState(false);

  const boardProgress = progress(board);
  const theme = board.style.theme;
  const editingCell =
    editingIndex === null ? undefined : board.cells[editingIndex];

  return (
    <Screen
      title={board.title}
      theme={theme}
      actions={
        <HeaderButton
          label="Cambiar tema"
          icon="🎨"
          onClick={() => setIsChoosingTheme(true)}
        />
      }
    >
      <section className={styles.progress} aria-label="Progreso">
        <div className={styles.progressHeader}>
          <span>
            <span aria-hidden="true">{THEMES[theme].emoji}</span> Progreso
          </span>
          <span className={styles.percentage}>{boardProgress.percentage}%</span>
        </div>
        <ProgressBar label="Progreso del tablero" progress={boardProgress} />
        <p className={styles.progressText}>
          {boardProgress.completed} de {boardProgress.total} conseguidos
        </p>
      </section>

      <Board
        board={board}
        mode={isEditing ? 'edit' : 'play'}
        onCellClick={isEditing ? setEditingIndex : onToggle}
      />

      <div className={styles.footer}>
        <Button
          variant="secondary"
          aria-pressed={isEditing}
          onClick={() => setIsEditing(!isEditing)}
        >
          ✏️ Editar casillas
        </Button>
        <p className={styles.hint}>
          {isEditing
            ? 'Toca una casilla para editarla.'
            : 'Toca una casilla para marcarla.'}
        </p>
      </div>

      <nav className={styles.sections} aria-label="Secciones">
        {SECTIONS.map(({ section, label, icon }) => (
          <button
            key={section}
            type="button"
            className={styles.section}
            onClick={() => onOpen(section)}
          >
            <span className={styles.sectionIcon} aria-hidden="true">
              {icon}
            </span>
            {label}
          </button>
        ))}
      </nav>

      {editingIndex !== null && editingCell && (
        <EditCellDialog
          cell={editingCell}
          onCancel={() => setEditingIndex(null)}
          onSave={(changes) => {
            onUpdate(editingIndex, changes);
            setEditingIndex(null);
          }}
        />
      )}

      {isChoosingTheme && (
        <ThemeDialog
          theme={theme}
          onSelect={onThemeChange}
          onClose={() => setIsChoosingTheme(false)}
        />
      )}

      {win !== 'none' && <Celebration win={win} onClose={onDismissWin} />}
    </Screen>
  );
}
