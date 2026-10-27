import type { BingoProgress } from '@bingogoals/domain';
import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  label: string;
  progress: BingoProgress;
}

export function ProgressBar({ label, progress }: ProgressBarProps) {
  const { completed, total, percentage } = progress;

  return (
    <div
      className={styles.bar}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={completed}
      aria-valuetext={`${completed} de ${total} conseguidos`}
    >
      <div className={styles.fill} style={{ width: `${percentage}%` }} />
    </div>
  );
}
