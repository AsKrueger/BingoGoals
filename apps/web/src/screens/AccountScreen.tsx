import { useEffect, useId, useState } from 'react';
import { NetworkError } from '../account/api';
import type { Account } from '../account/useAccount';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import { Screen } from '../components/Screen';
import { SYNC_LABELS } from '../components/SyncBadge';
import type { Sync } from '../hooks/useSync';
import { usePhotos } from '../hooks/usePhotos';
import { readLegacyRecord } from '../storage/schema';
import type { BoardStorage, UnreadableCopy } from '../storage/storage';
import type { BoardStore } from '../store/boardStore';
import styles from './AccountScreen.module.css';
import type { AuthMode } from './AuthScreen';

interface AccountScreenProps {
  account: Account;
  sync: Sync;
  store: BoardStore;
  storage: BoardStorage;
  onOpenAuth: (mode: AuthMode) => void;
  onBack: () => void;
}

const NO_CONNECTION =
  'No hay conexión con el servidor. Inténtalo de nuevo más tarde.';

const TIME_FORMAT = new Intl.DateTimeFormat('es-ES', { timeStyle: 'short' });

export function AccountScreen({
  account,
  sync,
  store,
  storage,
  onOpenAuth,
  onBack,
}: AccountScreenProps) {
  const [dialog, setDialog] = useState<'logout' | 'delete' | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState('');
  const user = account.user;
  const pendingCount = store.getSnapshot().pendingCount;

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
      {user ? (
        <>
          <section className={styles.card} aria-labelledby="account-session">
            <h2 id="account-session" className={styles.heading}>
              Sesión iniciada
            </h2>
            <p className={styles.email}>{user.email}</p>
            <Button
              variant="secondary"
              className={styles.action}
              disabled={isPending}
              onClick={() => setDialog('logout')}
            >
              Cerrar sesión
            </Button>
          </section>

          <section className={styles.card} aria-labelledby="account-sync">
            <h2 id="account-sync" className={styles.heading}>
              Sincronización
            </h2>
            <p className={styles.text}>
              Tus tableros se guardan en este dispositivo y en tu cuenta, y
              aparecen en cualquier dispositivo donde inicies sesión.
            </p>
            {sync.status && (
              <p className={styles.syncState}>
                <span aria-hidden="true">{SYNC_LABELS[sync.status].icon}</span>{' '}
                {SYNC_LABELS[sync.status].text}
                {sync.lastSyncedAt &&
                  ` · última vez a las ${TIME_FORMAT.format(sync.lastSyncedAt)}`}
              </p>
            )}
            <Button
              variant="secondary"
              className={styles.action}
              onClick={sync.syncNow}
            >
              Sincronizar ahora
            </Button>
          </section>

          <section className={styles.card} aria-labelledby="account-delete">
            <h2 id="account-delete" className={styles.heading}>
              Borrar cuenta
            </h2>
            <p className={styles.text}>
              Borra tu cuenta y sus tableros del servidor. Los tableros de este
              dispositivo se conservan.
            </p>
            <Button
              variant="danger"
              className={styles.action}
              disabled={isPending}
              onClick={() => setDialog('delete')}
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
            Con una cuenta, tus tableros se guardan también en el servidor y
            aparecen en todos tus dispositivos.
          </p>
          <div className={styles.actions}>
            <Button onClick={() => onOpenAuth('register')}>Crear cuenta</Button>
            <Button variant="secondary" onClick={() => onOpenAuth('login')}>
              Iniciar sesión
            </Button>
          </div>
        </section>
      )}

      <UnreadableCopies store={store} storage={storage} />

      {user && account.isOffline && !error && (
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

      {dialog === 'logout' && user && (
        <LogoutDialog
          pendingCount={pendingCount}
          onCancel={() => setDialog(null)}
          onLogout={(removeBoards) => {
            setDialog(null);
            void run(async () => {
              await account.logout();
              if (removeBoards) {
                store.removeOwner(user.id);
              }
            });
          }}
        />
      )}

      {dialog === 'delete' && user && (
        <ConfirmDialog
          title="¿Borrar tu cuenta?"
          message={`Se borrarán del servidor la cuenta ${user.email} y sus tableros, y no se podrán recuperar. Los tableros de este dispositivo se conservan.`}
          confirmLabel="Borrar cuenta"
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            setDialog(null);
            void run(async () => {
              await account.deleteAccount();
              store.releaseOwner(user.id);
            });
          }}
        />
      )}
    </Screen>
  );
}

interface LogoutDialogProps {
  /** Tableros de la cuenta con cambios que aún no están en el servidor. */
  pendingCount: number;
  onLogout: (removeBoards: boolean) => void;
  onCancel: () => void;
}

/** Al cerrar sesión se elige si los tableros de la cuenta siguen aquí. */
function LogoutDialog({ pendingCount, onLogout, onCancel }: LogoutDialogProps) {
  const titleId = useId();
  return (
    <Modal labelledBy={titleId} onClose={onCancel} className={styles.dialog}>
      <h2 id={titleId} className={styles.dialogTitle}>
        ¿Cerrar sesión?
      </h2>
      <p className={styles.text}>
        Tus tableros siguen guardados en tu cuenta. ¿Quieres quitarlos también
        de este dispositivo?
      </p>
      {pendingCount > 0 && (
        <p className={styles.warning}>
          Hay {pendingCount}{' '}
          {pendingCount === 1 ? 'tablero con cambios' : 'tableros con cambios'}{' '}
          que todavía no han llegado al servidor: si los quitas, esos cambios se
          perderán.
        </p>
      )}
      <div className={styles.dialogActions}>
        <Button variant="ghost" autoFocus onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="secondary" onClick={() => onLogout(false)}>
          Conservar aquí
        </Button>
        <Button variant="danger" onClick={() => onLogout(true)}>
          Quitar de aquí
        </Button>
      </div>
    </Modal>
  );
}

function describeCopy(copy: UnreadableCopy): string {
  const date = /unreadable-(\d{4}-\d{2}-\d{2}T[\d:.]+Z)/.exec(copy.key)?.[1];
  return date
    ? `Copia del ${new Date(date).toLocaleString('es-ES')}`
    : 'Copia de datos';
}

/**
 * Copias de datos que no se pudieron leer: se pueden intentar recuperar, por
 * si la versión actual ya sabe leerlas, o descargar como archivo.
 */
function UnreadableCopies({
  store,
  storage,
}: {
  store: BoardStore;
  storage: BoardStorage;
}) {
  const [copies, setCopies] = useState<UnreadableCopy[]>([]);
  const [message, setMessage] = useState('');
  const photos = usePhotos();

  useEffect(() => {
    let cancelled = false;
    storage.unreadableCopies().then(
      (found) => !cancelled && setCopies(found),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [storage]);

  if (copies.length === 0) {
    return null;
  }

  async function recover(copy: UnreadableCopy) {
    const result = readLegacyRecord(copy.raw);
    if (result.status !== 'loaded') {
      setMessage(
        'Esta versión de BingoGoals tampoco puede leer la copia. Descárgala para conservarla.',
      );
      return;
    }
    // Las fotos que iban dentro de la copia se guardan antes que sus tableros.
    try {
      await photos?.addAll(result.photos);
    } catch {
      // Sin espacio para las fotos, los tableros se recuperan sin ellas.
    }
    const added = store.importBoards(result.data);
    setMessage(
      added === 0
        ? 'La copia se ha leído, pero sus tableros ya estaban en el dispositivo.'
        : `Recuperados ${added} ${added === 1 ? 'tablero' : 'tableros'}.`,
    );
  }

  function download(copy: UnreadableCopy) {
    const file = new Blob([JSON.stringify(copy.raw, null, 2)], {
      type: 'application/json',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(file);
    link.download = `bingogoals-${copy.key}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <section className={styles.card} aria-labelledby="account-copies">
      <h2 id="account-copies" className={styles.heading}>
        Datos que no se pudieron leer
      </h2>
      <p className={styles.text}>
        Se conservan en este dispositivo y no se borran nunca solos.
      </p>
      <ul className={styles.copies}>
        {copies.map((copy) => (
          <li key={copy.key} className={styles.copy}>
            <span>{describeCopy(copy)}</span>
            <span className={styles.actions}>
              <Button variant="secondary" onClick={() => void recover(copy)}>
                Intentar recuperar
              </Button>
              <Button variant="ghost" onClick={() => download(copy)}>
                Descargar
              </Button>
            </span>
          </li>
        ))}
      </ul>
      {message && (
        <p className={styles.text} role="status">
          {message}
        </p>
      )}
    </section>
  );
}
