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

/** Un archivo tal cual, sin JSON: una foto. */
export interface FileBody {
  readonly type: string;
  readonly bytes: ArrayBuffer;
}

export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  token?: string;
  /** Cuerpo que se envía como JSON. */
  body?: unknown;
  /** Archivo que se envía tal cual, en lugar de `body`. */
  file?: FileBody;
  /** Si es true, la respuesta es un archivo (FileBody), no JSON. */
  expectFile?: boolean;
}

export type Requester = <T>(
  path: string,
  options: RequestOptions,
) => Promise<T>;

/**
 * Peticiones a la API sobre `fetch`, en JSON salvo los archivos. Un fallo de
 * red, o no recibir respuesta en `timeoutMs`, lanza `NetworkError`; una
 * respuesta de error, `ApiError`.
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
    const { file, body: json } = options;
    let response: Response;
    try {
      response = await fetchFn(`${root}${path}`, {
        method: options.method,
        headers: {
          ...(file && { 'Content-Type': file.type }),
          ...(!file &&
            json !== undefined && { 'Content-Type': 'application/json' }),
          ...(options.token && { Authorization: `Bearer ${options.token}` }),
        },
        body: file
          ? file.bytes
          : json === undefined
            ? undefined
            : JSON.stringify(json),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (options.expectFile && response.ok) {
        const received: FileBody = {
          type: response.headers.get('Content-Type') ?? '',
          bytes: await response.arrayBuffer(),
        };
        return received as T;
      }
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
