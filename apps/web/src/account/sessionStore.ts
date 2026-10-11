import type { Session } from './api';

/** Dónde se guarda la sesión en el dispositivo, para conservarla al recargar. */
export interface SessionStore {
  load(): Session | null;
  save(session: Session): void;
  clear(): void;
}

const KEY = 'bingogoals.session';

function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { token, user } = value as { token?: unknown; user?: unknown };
  const { id, email } = (
    typeof user === 'object' && user !== null ? user : {}
  ) as { id?: unknown; email?: unknown };
  return (
    typeof token === 'string' &&
    token !== '' &&
    typeof id === 'string' &&
    typeof email === 'string'
  );
}

/**
 * Guarda la sesión en `localStorage`. Si el almacenamiento no está disponible
 * o lo guardado no tiene sentido, se comporta como si no hubiera sesión.
 */
export function createLocalSessionStore(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = localStorage,
): SessionStore {
  return {
    load() {
      try {
        const value: unknown = JSON.parse(storage.getItem(KEY) ?? 'null');
        return isSession(value)
          ? { token: value.token, user: value.user }
          : null;
      } catch {
        return null;
      }
    },
    save(session) {
      try {
        storage.setItem(KEY, JSON.stringify(session));
      } catch {
        // Sin almacenamiento la sesión dura hasta que se cierre la página.
      }
    },
    clear() {
      try {
        storage.removeItem(KEY);
      } catch {
        // Nada que borrar.
      }
    },
  };
}

/** Sesión solo en memoria, para los tests. */
export function createMemorySessionStore(
  initial: Session | null = null,
): SessionStore & { current: Session | null } {
  return {
    current: initial,
    load() {
      return this.current;
    },
    save(session) {
      this.current = session;
    },
    clear() {
      this.current = null;
    },
  };
}
