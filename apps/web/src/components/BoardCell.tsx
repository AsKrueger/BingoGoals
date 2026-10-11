import type { CSSProperties } from 'react';
import type { BingoCell } from '../domain';
import styles from './BoardCell.module.css';

export type BoardMode = 'play' | 'edit';

interface BoardCellProps {
  cell: BingoCell;
  mode: BoardMode;
  onClick: () => void;
}

export function BoardCell({ cell, mode, onClick }: BoardCellProps) {
  const text = cell.text || 'Objetivo';
  const name = cell.isCentralStar ? `${text} (estrella central)` : text;
  const icon = cell.icon ?? (cell.isCentralStar ? '⭐' : null);

  const className = [
    styles.cell,
    cell.isCompleted && styles.completed,
    cell.isCentralStar && styles.star,
    cell.imagePath && styles.withPhoto,
    cell.color && styles.withColor,
  ]
    .filter(Boolean)
    .join(' ');

  const style = {
    '--cell-color': cell.color ?? undefined,
    backgroundImage: cell.imagePath ? `url("${cell.imagePath}")` : undefined,
  } as CSSProperties;

  return (
    <button
      type="button"
      className={className}
      style={style}
      aria-label={mode === 'edit' ? `Editar: ${name}` : name}
      aria-pressed={mode === 'play' ? cell.isCompleted : undefined}
      onClick={onClick}
    >
      {icon && !cell.imagePath && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      <span className={styles.text}>{text}</span>
      {cell.isCompleted && (
        <span className={styles.check} aria-hidden="true">
          ✓
        </span>
      )}
    </button>
  );
}
