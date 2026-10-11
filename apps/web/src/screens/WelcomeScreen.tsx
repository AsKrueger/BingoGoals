import styles from './WelcomeScreen.module.css';

interface WelcomeScreenProps {
  onStart: () => void;
  /** Si se indica, se ofrece ver el historial de tableros archivados. */
  onOpenHistory?: () => void;
}

export function WelcomeScreen({ onStart, onOpenHistory }: WelcomeScreenProps) {
  return (
    <main className={styles.screen}>
      <span className={styles.logo} aria-hidden="true">
        🎯
      </span>
      <h1 className={styles.title}>BingoGoals</h1>
      <p className={styles.tagline}>
        Gamifica tus propósitos de vida. Crea tu tablero, marca tus logros y
        alcanza el bingo de tus sueños.
      </p>
      <button type="button" className={styles.start} onClick={onStart}>
        Empezar ahora
      </button>
      {onOpenHistory && (
        <button
          type="button"
          className={styles.history}
          onClick={onOpenHistory}
        >
          Ver historial
        </button>
      )}
    </main>
  );
}
