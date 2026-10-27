import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { Account, AccountServices } from '../account/useAccount';
import type { BoardStore } from '../store/boardStore';
import type { PhotoStore } from '../store/photoStore';
import { createSyncEngine, type SyncStatus } from '../sync/syncEngine';

const noSubscription = () => () => {};

export interface Sync {
  /** Estado de la sincronización, o null si no hay sesión. */
  readonly status: SyncStatus | null;
  readonly lastSyncedAt: Date | null;
  /** Sincroniza ya, sin esperar al siguiente intento. */
  syncNow(): void;
}

/**
 * Mientras haya sesión, sincroniza los tableros de esa cuenta. Sin sesión no
 * hace nada: la web funciona igual, con los datos solo en el dispositivo.
 */
export function useSync(
  store: BoardStore,
  photos: PhotoStore,
  account: Account,
  { boardsApi, sessionStore }: AccountServices,
): Sync {
  const userId = account.user?.id ?? null;

  // La comprobación de sesión cambia con cada render; el motor usa siempre
  // la más reciente.
  const refresh = useRef(account.refresh);
  useEffect(() => {
    refresh.current = account.refresh;
  });

  // Los tableros visibles y los que se suben dependen de la cuenta.
  useEffect(() => {
    store.setViewer(userId);
  }, [store, userId]);

  const engine = useMemo(
    () =>
      userId
        ? createSyncEngine({
            store,
            photos,
            api: boardsApi,
            userId,
            getToken: () => sessionStore.load()?.token ?? null,
          })
        : null,
    [store, photos, boardsApi, sessionStore, userId],
  );

  useEffect(() => {
    if (!engine) {
      return;
    }
    // Si la sesión caducó, la cuenta lo comprueba y la cierra.
    const stopListening = engine.onUnauthorized(() => void refresh.current());
    engine.start();
    return () => {
      stopListening();
      engine.stop();
    };
  }, [engine]);

  const status = useSyncExternalStore(
    engine?.subscribe ?? noSubscription,
    () => engine?.getStatus() ?? null,
  );

  return {
    status,
    lastSyncedAt: engine?.lastSyncedAt() ?? null,
    syncNow: () => void engine?.syncNow(),
  };
}
