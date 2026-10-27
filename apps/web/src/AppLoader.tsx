import { useEffect, useState } from 'react';
import type { AccountServices } from './account/useAccount';
import { App, type LoadProblem } from './App';
import styles from './AppLoader.module.css';
import {
  EMPTY_LOCAL_DATA,
  type BoardStorage,
  type LoadResult,
} from './storage/storage';
import { createBoardStore, type BoardStore } from './store/boardStore';

interface AppLoaderProps {
  storage: BoardStorage;
  accountServices: AccountServices;
  /** Cuánto se espera al almacenamiento antes de darlo por no disponible. */
  timeoutMs?: number;
}

interface Loaded {
  store: BoardStore;
  problem: LoadProblem | null;
}

const LOAD_TIMEOUT_MS = 10_000;

/** Lee lo guardado, o rechaza si el almacenamiento no responde a tiempo. */
function loadWithTimeout(
  storage: BoardStorage,
  timeoutMs: number,
): Promise<LoadResult> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('El almacenamiento no responde.')),
      timeoutMs,
    );
    storage.load().then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Carga los datos guardados antes de mostrar la web. Si no se pueden leer, o
 * el almacenamiento no responde, la web arranca vacía en lugar de fallar,
 * pero lo avisa: no es lo mismo que no tener datos.
 */
export function AppLoader({
  storage,
  accountServices,
  timeoutMs = LOAD_TIMEOUT_MS,
}: AppLoaderProps) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;
    let store: BoardStore | null = null;
    loadWithTimeout(storage, timeoutMs).then(
      (result) => {
        if (cancelled) {
          return;
        }
        store = createBoardStore(
          storage,
          result.status === 'loaded' ? result.data : EMPTY_LOCAL_DATA,
        );
        const problem =
          result.status === 'unreadable' ||
          (result.status === 'loaded' && result.skipped > 0)
            ? 'unreadable'
            : null;
        setLoaded({ store, problem });
      },
      () => {
        if (!cancelled) {
          store = createBoardStore(storage, EMPTY_LOCAL_DATA);
          setLoaded({ store, problem: 'unavailable' });
        }
      },
    );
    return () => {
      cancelled = true;
      store?.dispose();
    };
  }, [storage, timeoutMs]);

  if (!loaded) {
    return (
      <div className={styles.loading} role="status">
        <span className={styles.spinner} aria-hidden="true" />
        Cargando tus tableros…
      </div>
    );
  }

  return (
    <App
      store={loaded.store}
      storage={storage}
      accountServices={accountServices}
      loadProblem={loaded.problem}
    />
  );
}
