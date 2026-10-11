import styles from './WelcomeScreen.module.css';
import { Button } from '../components/Button';

interface WelcomeScreenProps {
  onStart: () => void;
  /** Si se indica, se ofrece ver el historial de tableros archivados. */
  onOpenHistory?: () => void;
  onOpenAccount: () => void;
}

export function WelcomeScreen({
  onStart,
  onOpenHistory,
  onOpenAccount,
}: WelcomeScreenProps) {
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
      <Button
        variant="inverse"
        size="large"
        className={styles.start}
        onClick={onStart}
      >
        Empezar ahora
      </Button>
      {onOpenHistory && (
        <Button variant="inverseOutline" onClick={onOpenHistory}>
          Ver historial
        </Button>
      )}
      <Button variant="inverseOutline" onClick={onOpenAccount}>
        Cuenta
      </Button>
    </main>
  );
}
