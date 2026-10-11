export interface AccountUser {
  readonly id: string;
  readonly email: string;
}

/** Una sesión iniciada: el identificador que la demuestra y de quién es. */
export interface Session {
  readonly token: string;
  readonly user: AccountUser;
}

/** Mensaje de error de cada campo del formulario, para mostrarlo junto a él. */
export interface FieldErrors {
  readonly email?: string;
  readonly password?: string;
}

/** La API ha respondido con un error: datos inválidos, sesión caducada… */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fieldErrors: FieldErrors = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** No se ha podido hablar con la API: sin conexión o servidor apagado. */
export class NetworkError extends Error {
  constructor() {
    super('No se puede conectar con el servidor.');
    this.name = 'NetworkError';
  }
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

interface RequestOptions {
  method: 'GET' | 'POST' | 'DELETE';
  token?: string;
  body?: unknown;
}

/** Cliente de la API sobre `fetch`. `baseUrl` sale de `VITE_API_URL`. */
export function createAccountApi(
  baseUrl: string,
  fetchFn: typeof fetch = fetch,
): AccountApi {
  const root = baseUrl.replace(/\/+$/, '');

  async function request<T>(path: string, options: RequestOptions): Promise<T> {
    let response: Response;
    try {
      response = await fetchFn(`${root}${path}`, {
        method: options.method,
        headers: {
          ...(options.body !== undefined && {
            'Content-Type': 'application/json',
          }),
          ...(options.token && { Authorization: `Bearer ${options.token}` }),
        },
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new NetworkError();
    }

    const text = await response.text().catch(() => '');
    let body: unknown = null;
    try {
      body = text === '' ? null : JSON.parse(text);
    } catch {
      // Una respuesta que no es JSON se trata como si no tuviera cuerpo.
    }

    if (!response.ok) {
      const details = (body ?? {}) as {
        message?: unknown;
        errors?: FieldErrors;
      };
      throw new ApiError(
        response.status,
        typeof details.message === 'string'
          ? details.message
          : 'El servidor ha respondido con un error.',
        details.errors ?? {},
      );
    }
    return body as T;
  }

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
