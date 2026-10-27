import { useCallback, useEffect, useState } from 'react';
import {
  ApiError,
  NetworkError,
  type AccountApi,
  type AccountUser,
  type Session,
} from './api';
import type { BoardsApi } from '../sync/boardsApi';
import type { SessionStore } from './sessionStore';

/**
 * Lo que hace falta para la cuenta y la sincronización: las APIs y dónde
 * guardar la sesión.
 */
export interface AccountServices {
  readonly api: AccountApi;
  readonly boardsApi: BoardsApi;
  readonly sessionStore: SessionStore;
}

export interface Account {
  /** El usuario con sesión iniciada, o null si no hay sesión. */
  readonly user: AccountUser | null;
  /** true si la última vez no se pudo hablar con el servidor. */
  readonly isOffline: boolean;
  register(email: string, password: string): Promise<void>;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  deleteAccount(): Promise<void>;
  /** Vuelve a comprobar la sesión con el servidor. */
  refresh(): Promise<void>;
}

/** Qué dice el servidor de una sesión guardada. */
type SessionCheck =
  | { readonly result: 'valid'; readonly user: AccountUser }
  /** Caducó o se cerró desde otro sitio. */
  | { readonly result: 'expired' }
  /** Sin conexión no se sabe nada: la sesión se conserva. */
  | { readonly result: 'offline' }
  | { readonly result: 'unknown' };

async function checkSession(
  api: AccountApi,
  session: Session,
): Promise<SessionCheck> {
  try {
    return { result: 'valid', user: await api.me(session.token) };
  } catch (error) {
    if (error instanceof NetworkError) {
      return { result: 'offline' };
    }
    if (error instanceof ApiError && error.status === 401) {
      return { result: 'expired' };
    }
    return { result: 'unknown' };
  }
}

/**
 * Sesión del usuario. La cuenta es opcional: sin sesión, o con el servidor
 * apagado, el resto de la web funciona igual.
 */
export function useAccount({ api, sessionStore }: AccountServices): Account {
  const [session, setSession] = useState<Session | null>(() =>
    sessionStore.load(),
  );
  const [isOffline, setIsOffline] = useState(false);

  const start = useCallback(
    (started: Session) => {
      sessionStore.save(started);
      setSession(started);
      setIsOffline(false);
    },
    [sessionStore],
  );

  const end = useCallback(() => {
    sessionStore.clear();
    setSession(null);
    setIsOffline(false);
  }, [sessionStore]);

  const apply = useCallback(
    (checked: Session, check: SessionCheck) => {
      if (check.result === 'valid') {
        start({ token: checked.token, user: check.user });
      } else if (check.result === 'expired') {
        end();
      } else if (check.result === 'offline') {
        setIsOffline(true);
      }
    },
    [start, end],
  );

  // Al abrir la web se comprueba la sesión que hubiera guardada.
  useEffect(() => {
    const stored = sessionStore.load();
    if (!stored) {
      return;
    }
    let cancelled = false;
    void checkSession(api, stored).then((check) => {
      if (!cancelled) {
        apply(stored, check);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [api, sessionStore, apply]);

  return {
    user: session?.user ?? null,
    isOffline,

    async register(email, password) {
      start(await api.register(email, password));
    },
    async login(email, password) {
      start(await api.login(email, password));
    },
    async logout() {
      if (!session) {
        return;
      }
      try {
        await api.logout(session.token);
      } catch (error) {
        // Una sesión que el servidor ya no reconoce está cerrada igualmente.
        if (!(error instanceof ApiError && error.status === 401)) {
          throw error;
        }
      }
      end();
    },
    async deleteAccount() {
      if (!session) {
        return;
      }
      await api.deleteAccount(session.token);
      end();
    },
    async refresh() {
      if (session) {
        apply(session, await checkSession(api, session));
      }
    },
  };
}
