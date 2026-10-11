import { useEffect, useState } from 'react';
import type { AccountServices } from './account/useAccount';
import { App, type LoadProblem } from './App';
import styles from './AppLoader.module.css';
import { EMPTY_DATA, type AppData, type BoardStorage } from './storage/storage';

interface AppLoaderProps {
  storage: BoardStorage;
  accountServices: AccountServices;
}

interface Loaded {
  data: AppData;
  problem: LoadProblem | null;
}

/**
 * Carga los datos guardados antes de mostrar la web. Si no se pueden leer, la
 * web arranca vacía en lugar de fallar, pero lo avisa: no es lo mismo que no
 * tener datos.
 */
export function AppLoader({ storage, accountServices }: AppLoaderProps) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;
    storage.load().then(
      (result) => {
        if (cancelled) {
          return;
        }
        setLoaded(
          result.status === 'loaded'
            ? { data: result.data, problem: null }
            : {
                data: EMPTY_DATA,
                problem: result.status === 'unreadable' ? 'unreadable' : null,
              },
        );
      },
      () => {
        if (!cancelled) {
          setLoaded({ data: EMPTY_DATA, problem: 'unavailable' });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [storage]);

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
      initialData={loaded.data}
      storage={storage}
      accountServices={accountServices}
      loadProblem={loaded.problem}
    />
  );
}
