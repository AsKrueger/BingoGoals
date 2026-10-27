import { useEffect, useId, type CSSProperties } from 'react';
import type { BingoWin } from '@bingogoals/domain';
import styles from './Celebration.module.css';
import { Modal } from './Modal';
import { Button } from './Button';

interface CelebrationProps {
  win: Exclude<BingoWin, 'none'>;
  onClose: () => void;
}

const CONTENT = {
  line: {
    emoji: '🎉',
    title: '¡LÍNEA!',
    message: '¡Sigue así, vas por buen camino!',
    confetti: 24,
  },
  bingo: {
    emoji: '🏆',
    title: '¡BINGO!',
    message: '¡Has completado todo el tablero!',
    confetti: 70,
  },
};

const CONFETTI_COLORS = ['#f44336', '#ffc107', '#4caf50', '#2196f3', '#e91e63'];

/** La celebración de línea se cierra sola; la de bingo espera al usuario. */
const LINE_DURATION_MS = 4000;

export function Celebration({ win, onClose }: CelebrationProps) {
  const titleId = useId();
  const { emoji, title, message, confetti } = CONTENT[win];

  useEffect(() => {
    if (win !== 'line') {
      return;
    }
    const timeout = setTimeout(onClose, LINE_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [win, onClose]);

  return (
    <Modal
      labelledBy={titleId}
      onClose={onClose}
      className={`${styles.dialog} ${styles[win]}`}
      backdropClassName={styles.backdrop}
    >
      <div className={styles.confetti} aria-hidden="true">
        {Array.from({ length: confetti }, (_, index) => (
          <span
            key={index}
            className={styles.piece}
            style={
              {
                // Reparto fijo, sin azar, para que el render sea puro.
                '--x': `${(index * 37) % 100}%`,
                '--delay': `${((index * 13) % 20) / 10}s`,
                '--color': CONFETTI_COLORS[index % CONFETTI_COLORS.length],
              } as CSSProperties
            }
          />
        ))}
      </div>
      <span className={styles.emoji} aria-hidden="true">
        {emoji}
      </span>
      <h2 id={titleId} className={styles.title}>
        {title}
      </h2>
      <p className={styles.message}>{message}</p>
      <Button autoFocus onClick={onClose}>
        Seguir jugando
      </Button>
    </Modal>
  );
}
