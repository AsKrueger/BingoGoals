import type { CSSProperties } from 'react';
import { Screen } from '../components/Screen';
import {
  boardDimension,
  boardStats,
  type BingoBoard,
  type LineCount,
} from '@bingogoals/domain';
import { formatDate } from '../format';
import styles from './StatsScreen.module.css';

interface StatsScreenProps {
  board: BingoBoard;
  onBack: () => void;
}

export function StatsScreen({ board, onBack }: StatsScreenProps) {
  const stats = boardStats(board);
  const dimension = boardDimension(board.size);

  return (
    <Screen
      title="Estadísticas"
      theme={board.style.theme}
      onBack={onBack}
      backLabel="Volver al tablero"
    >
      <section className={styles.card} aria-labelledby="stats-progress">
        <h2 id="stats-progress" className={styles.heading}>
          Progreso general
        </h2>
        <div
          className={styles.donut}
          style={{ '--percentage': stats.percentage } as CSSProperties}
          role="img"
          aria-label={`${stats.percentage} % completado`}
        >
          <span className={styles.donutValue}>{stats.percentage} %</span>
        </div>
        <dl className={styles.tiles}>
          <div className={styles.tile}>
            <dt>Completadas</dt>
            <dd>{stats.completed}</dd>
          </div>
          <div className={styles.tile}>
            <dt>Pendientes</dt>
            <dd>{stats.pending}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.card} aria-labelledby="stats-lines">
        <h2 id="stats-lines" className={styles.heading}>
          Líneas completadas
        </h2>
        <dl className={styles.bars}>
          <LineBar label="Total" count={stats.lines} />
          <LineBar label="Filas" count={stats.linesByType.row} />
          <LineBar label="Columnas" count={stats.linesByType.column} />
          <LineBar label="Diagonales" count={stats.linesByType.diagonal} />
        </dl>
      </section>

      <section className={styles.card} aria-labelledby="stats-summary">
        <h2 id="stats-summary" className={styles.heading}>
          Resumen del tablero
        </h2>
        <dl className={styles.details}>
          <div className={styles.detail}>
            <dt>Nombre</dt>
            <dd>{board.title}</dd>
          </div>
          <div className={styles.detail}>
            <dt>Tamaño</dt>
            <dd>
              {dimension} × {dimension}
            </dd>
          </div>
          <div className={styles.detail}>
            <dt>Fecha de creación</dt>
            <dd>{formatDate(board.createdAt)}</dd>
          </div>
          <div className={styles.detail}>
            <dt>Días desde su creación</dt>
            <dd>{stats.daysSinceCreation}</dd>
          </div>
        </dl>
      </section>
    </Screen>
  );
}

function LineBar({ label, count }: { label: string; count: LineCount }) {
  const fill = count.total === 0 ? 0 : (count.completed / count.total) * 100;

  return (
    <div
      className={styles.bar}
      style={{ '--fill': `${fill}%` } as CSSProperties}
    >
      <dt>{label}</dt>
      <dd>
        {count.completed} de {count.total}
      </dd>
    </div>
  );
}
