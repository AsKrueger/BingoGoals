import { useState } from 'react';
import { NetworkError } from '../account/api';
import type { Account } from '../account/useAccount';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Screen } from '../components/Screen';
import styles from './AccountScreen.module.css';
import type { AuthMode } from './AuthScreen';

interface AccountScreenProps {
  account: Account;
  onOpenAuth: (mode: AuthMode) => void;
  onBack: () => void;
}

const NO_CONNECTION =
  'No hay conexión con el servidor. Inténtalo de nuevo más tarde.';

export function AccountScreen({
  account,
  onOpenAuth,
  onBack,
}: AccountScreenProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState('');

  /** Ejecuta una acción de la cuenta y muestra el error si falla. */
  async function run(action: () => Promise<void>) {
    setError('');
    setIsPending(true);
    try {
      await action();
    } catch (reason) {
      setError(
        reason instanceof NetworkError
          ? NO_CONNECTION
          : 'No se ha podido completar la acción. Inténtalo de nuevo.',
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Screen title="Cuenta" onBack={onBack}>
      {account.user ? (
        <>
          <section className={styles.card} aria-labelledby="account-session">
            <h2 id="account-session" className={styles.heading}>
              Sesión iniciada
            </h2>
            <p className={styles.email}>{account.user.email}</p>
            <p className={styles.text}>
              La sincronización de tableros todavía no está disponible: de
              momento siguen guardados solo en este dispositivo.
            </p>
            <Button
              variant="secondary"
              className={styles.action}
              disabled={isPending}
              onClick={() => run(account.logout)}
            >
              Cerrar sesión
            </Button>
          </section>

          <section className={styles.card} aria-labelledby="account-delete">
            <h2 id="account-delete" className={styles.heading}>
              Borrar cuenta
            </h2>
            <p className={styles.text}>
              Borra tu cuenta del servidor. Los tableros de este dispositivo se
              conservan.
            </p>
            <Button
              variant="danger"
              className={styles.action}
              disabled={isPending}
              onClick={() => setIsConfirmingDelete(true)}
            >
              Borrar cuenta
            </Button>
          </section>
        </>
      ) : (
        <section className={styles.card} aria-labelledby="account-anonymous">
          <h2 id="account-anonymous" className={styles.heading}>
            Sin cuenta
          </h2>
          <p className={styles.text}>
            La cuenta es opcional: BingoGoals funciona igual sin ella, con tus
            tableros guardados en este dispositivo.
          </p>
          <p className={styles.text}>
            Con una cuenta podrás, más adelante, tener tus tableros en varios
            dispositivos. Esa sincronización todavía no está disponible.
          </p>
          <div className={styles.actions}>
            <Button onClick={() => onOpenAuth('register')}>Crear cuenta</Button>
            <Button variant="secondary" onClick={() => onOpenAuth('login')}>
              Iniciar sesión
            </Button>
          </div>
        </section>
      )}

      {account.user && account.isOffline && !error && (
        <div className={styles.notice} role="status">
          <p className={styles.noticeText}>
            No hay conexión con el servidor. Tu sesión se conserva en este
            dispositivo.
          </p>
          <Button
            variant="secondary"
            disabled={isPending}
            onClick={() => run(account.refresh)}
          >
            Reintentar
          </Button>
        </div>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {isConfirmingDelete && account.user && (
        <ConfirmDialog
          title="¿Borrar tu cuenta?"
          message={`Se borrará la cuenta ${account.user.email} del servidor y no se podrá recuperar. Los tableros de este dispositivo se conservan.`}
          confirmLabel="Borrar cuenta"
          onCancel={() => setIsConfirmingDelete(false)}
          onConfirm={() => {
            setIsConfirmingDelete(false);
            void run(account.deleteAccount);
          }}
        />
      )}
    </Screen>
  );
}
