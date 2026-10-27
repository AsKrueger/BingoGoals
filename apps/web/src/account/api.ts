import { createRequester } from '../api/http';

export { ApiError, NetworkError, type FieldErrors } from '../api/http';

export interface AccountUser {
  readonly id: string;
  readonly email: string;
}

/** Una sesión iniciada: el identificador que la demuestra y de quién es. */
export interface Session {
  readonly token: string;
  readonly user: AccountUser;
}

/**
 * Lo que la web necesita de la API para las cuentas. Las pantallas solo
 * conocen esta interfaz.
 */
export interface AccountApi {
  register(email: string, password: string): Promise<Session>;
  login(email: string, password: string): Promise<Session>;
  /** Comprueba que la sesión sigue siendo válida y devuelve su usuario. */
  me(token: string): Promise<AccountUser>;
  logout(token: string): Promise<void>;
  deleteAccount(token: string): Promise<void>;
}

const TIMEOUT_MS = 10_000;

/** Cliente de la API sobre `fetch`. `baseUrl` sale de `VITE_API_URL`. */
export function createAccountApi(
  baseUrl: string,
  fetchFn: typeof fetch = fetch,
): AccountApi {
  const request = createRequester(baseUrl, { fetchFn, timeoutMs: TIMEOUT_MS });

  return {
    register: (email, password) =>
      request<Session>('/auth/register', {
        method: 'POST',
        body: { email, password },
      }),
    login: (email, password) =>
      request<Session>('/auth/login', {
        method: 'POST',
        body: { email, password },
      }),
    me: async (token) =>
      (
        await request<{ user: AccountUser }>('/auth/me', {
          method: 'GET',
          token,
        })
      ).user,
    logout: (token) => request<void>('/auth/logout', { method: 'POST', token }),
    deleteAccount: (token) =>
      request<void>('/auth/account', { method: 'DELETE', token }),
  };
}
