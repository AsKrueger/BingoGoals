import { ApiError, NetworkError } from '../api/http';
import type { BoardStore } from '../store/boardStore';
import type { BoardsApi } from './boardsApi';

export type SyncStatus =
  /** Todavía no ha sincronizado. */
  | 'idle'
  | 'syncing'
  /** El servidor tiene todo lo de este dispositivo. */
  | 'synced'
  /** Hay cambios que el servidor todavía no tiene. */
  | 'pending'
  /** El dispositivo no tiene conexión. */
  | 'offline'
  /** Hay conexión, pero el servidor no responde: puede estar despertando. */
  | 'waiting'
  /** El servidor ha rechazado algo. Se reintenta más tarde. */
  | 'error';

export interface SyncEngine {
  start(): void;
  stop(): void;
  /** Descarga los cambios del servidor y sube los pendientes. */
  syncNow(): Promise<void>;
  getStatus(): SyncStatus;
  lastSyncedAt(): Date | null;
  subscribe(listener: () => void): () => void;
  /** Avisa cuando el servidor ya no reconoce la sesión. */
  onUnauthorized(listener: () => void): () => void;
}

interface Timers {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  setInterval(callback: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

export interface SyncOptions {
  store: BoardStore;
  api: BoardsApi;
  userId: string;
  /** Identificador de la sesión actual, o null si ya no hay sesión. */
  getToken(): string | null;
  /** El servidor ya no reconoce la sesión. */
  onUnauthorized?: () => void;
  isOnline?: () => boolean;
  timers?: Timers;
  /** Espera tras un cambio local, para subir varios cambios seguidos de una vez. */
  debounceMs?: number;
  /** Cada cuánto se consultan cambios mientras la web está en primer plano. */
  pollMs?: number;
  /** Esperas entre reintentos, cada vez más largas. */
  backoffMs?: readonly number[];
}

const DEFAULT_BACKOFF = [2_000, 5_000, 15_000, 30_000, 60_000];

/**
 * Sincroniza los tableros de una cuenta. Primero el dispositivo: cada cambio
 * ya está guardado en local, y aquí solo se envía y se recibe en segundo
 * plano. Ante dos versiones de un tablero gana la más reciente.
 */
export function createSyncEngine({
  store,
  api,
  userId,
  getToken,
  onUnauthorized,
  isOnline = () => navigator.onLine,
  timers = {
    setTimeout: (callback, ms) => window.setTimeout(callback, ms),
    clearTimeout: (handle) => window.clearTimeout(handle as number),
    setInterval: (callback, ms) => window.setInterval(callback, ms),
    clearInterval: (handle) => window.clearInterval(handle as number),
  },
  debounceMs = 1_000,
  pollMs = 60_000,
  backoffMs = DEFAULT_BACKOFF,
}: SyncOptions): SyncEngine {
  let status: SyncStatus = 'idle';
  let lastSynced: Date | null = null;
  let isRunning = false;
  let runAgain = false;
  let isStarted = false;
  let failures = 0;
  let current: Promise<void> = Promise.resolve();
  let retryTimer: unknown = null;
  let debounceTimer: unknown = null;
  let pollTimer: unknown = null;
  const cleanups: (() => void)[] = [];
  const listeners = new Set<() => void>();
  const unauthorizedListeners = new Set<() => void>(
    onUnauthorized ? [onUnauthorized] : [],
  );

  function setStatus(next: SyncStatus) {
    if (next !== status) {
      status = next;
      for (const listener of listeners) {
        listener();
      }
    }
  }

  function settledStatus(): SyncStatus {
    return store.pendingFor(userId).length > 0 ? 'pending' : 'synced';
  }

  function scheduleRetry() {
    if (!isStarted) {
      return;
    }
    const delay = backoffMs[Math.min(failures, backoffMs.length - 1)] ?? 60_000;
    failures++;
    timers.clearTimeout(retryTimer);
    retryTimer = timers.setTimeout(() => void syncNow(), delay);
  }

  async function pull(token: string) {
    const { boards, cursor } = await api.list(token, store.cursorFor(userId));
    store.mergeRemote(boards, userId);
    store.setCursor(userId, cursor);
  }

  async function push(token: string) {
    for (const record of store.pendingFor(userId)) {
      const version = record.board.updatedAt;
      let outcome;
      try {
        outcome =
          record.deletedAt !== null
            ? await api.remove(token, record.board.id, record.deletedAt)
            : await api.put(token, {
                board: record.board,
                archivedAt: record.archivedAt,
              });
      } catch (error) {
        // Un tablero que el servidor no acepta no detiene a los demás.
        if (
          error instanceof ApiError &&
          (error.status === 400 || error.status === 404)
        ) {
          continue;
        }
        throw error;
      }
      if (outcome.status === 'saved') {
        store.markSynced(record.board.id, version);
      } else {
        // El servidor tiene una versión más reciente: gana esa.
        store.mergeRemote([outcome.current], userId, { force: true });
      }
    }
  }

  async function run() {
    const token = getToken();
    if (!token) {
      return;
    }
    isRunning = true;
    setStatus('syncing');
    try {
      do {
        runAgain = false;
        await pull(token);
        await push(token);
      } while (runAgain && isStarted);
      failures = 0;
      lastSynced = new Date();
      setStatus(settledStatus());
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setStatus('error');
        stop();
        for (const listener of unauthorizedListeners) {
          listener();
        }
      } else if (
        error instanceof NetworkError ||
        (error instanceof ApiError && error.status >= 500)
      ) {
        setStatus(isOnline() ? 'waiting' : 'offline');
        scheduleRetry();
      } else {
        setStatus('error');
        scheduleRetry();
      }
    } finally {
      isRunning = false;
    }
  }

  function syncNow(): Promise<void> {
    if (isRunning) {
      runAgain = true;
      return current;
    }
    timers.clearTimeout(retryTimer);
    current = run();
    return current;
  }

  function stop() {
    isStarted = false;
    timers.clearTimeout(retryTimer);
    timers.clearTimeout(debounceTimer);
    timers.clearInterval(pollTimer);
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  }

  return {
    start() {
      if (isStarted) {
        return;
      }
      isStarted = true;

      cleanups.push(
        store.onLocalChange(() => {
          if (!isRunning) {
            setStatus('pending');
          }
          timers.clearTimeout(debounceTimer);
          debounceTimer = timers.setTimeout(() => void syncNow(), debounceMs);
        }),
      );

      if (typeof window !== 'undefined') {
        const onOnline = () => void syncNow();
        const onVisible = () => {
          if (document.visibilityState === 'visible') {
            void syncNow();
          }
        };
        window.addEventListener('online', onOnline);
        document.addEventListener('visibilitychange', onVisible);
        cleanups.push(() => {
          window.removeEventListener('online', onOnline);
          document.removeEventListener('visibilitychange', onVisible);
        });
      }

      pollTimer = timers.setInterval(() => {
        if (typeof document === 'undefined' || !document.hidden) {
          void syncNow();
        }
      }, pollMs);

      void syncNow();
    },
    stop,
    syncNow,
    getStatus: () => status,
    lastSyncedAt: () => lastSynced,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onUnauthorized(listener) {
      unauthorizedListeners.add(listener);
      return () => unauthorizedListeners.delete(listener);
    },
  };
}
