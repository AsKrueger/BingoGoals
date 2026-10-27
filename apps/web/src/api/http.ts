/** Mensaje de error de cada campo de un formulario, para mostrarlo junto a él. */
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
    /** Cuerpo completo de la respuesta, por si trae más detalles. */
    readonly body: unknown = null,
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

export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  token?: string;
  body?: unknown;
}

export type Requester = <T>(
  path: string,
  options: RequestOptions,
) => Promise<T>;

/**
 * Peticiones JSON a la API sobre `fetch`. Un fallo de red, o no recibir
 * respuesta en `timeoutMs`, lanza `NetworkError`; una respuesta de error,
 * `ApiError`.
 */
export function createRequester(
  baseUrl: string,
  { fetchFn = fetch, timeoutMs }: { fetchFn?: typeof fetch; timeoutMs: number },
): Requester {
  const root = baseUrl.replace(/\/+$/, '');

  return async function request<T>(
    path: string,
    options: RequestOptions,
  ): Promise<T> {
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
        signal: AbortSignal.timeout(timeoutMs),
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
        body,
      );
    }
    return body as T;
  };
}
