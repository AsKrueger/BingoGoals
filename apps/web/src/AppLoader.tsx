import { useEffect, useState } from 'react';
import { App } from './App';
import styles from './AppLoader.module.css';
import { EMPTY_DATA, type AppData, type BoardStorage } from './storage/storage';

interface AppLoaderProps {
  storage: BoardStorage;
}

interface Loaded {
  data: AppData;
  failed: boolean;
}

/**
 * Carga los datos guardados antes de mostrar la web. Si no hay datos, están
 * corruptos o no se pueden leer, la web arranca vacía en lugar de fallar.
 */
export function AppLoader({ storage }: AppLoaderProps) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;
    storage.load().then(
      (data) => {
        if (!cancelled) {
          setLoaded({ data: data ?? EMPTY_DATA, failed: false });
        }
      },
      () => {
        if (!cancelled) {
          setLoaded({ data: EMPTY_DATA, failed: true });
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
      loadFailed={loaded.failed}
    />
  );
}
