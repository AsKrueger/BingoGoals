import type { CSSProperties } from 'react';
import type { BingoCell } from '@bingogoals/domain';
import styles from './BoardCell.module.css';

export type BoardMode = 'play' | 'edit' | 'readonly';

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
    mode === 'readonly' && styles.readonly,
  ]
    .filter(Boolean)
    .join(' ');

  const style = {
    '--cell-color': cell.color ?? undefined,
    backgroundImage: cell.imagePath ? `url("${cell.imagePath}")` : undefined,
  } as CSSProperties;

  const content = (
    <>
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
    </>
  );

  // En solo lectura la casilla no es un botón: ni se marca ni se edita.
  if (mode === 'readonly') {
    return (
      <div
        role="img"
        className={className}
        style={style}
        aria-label={`${name}: ${cell.isCompleted ? 'conseguida' : 'pendiente'}`}
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={className}
      style={style}
      aria-label={mode === 'edit' ? `Editar: ${name}` : name}
      aria-pressed={mode === 'play' ? cell.isCompleted : undefined}
      onClick={onClick}
    >
      {content}
    </button>
  );
}
