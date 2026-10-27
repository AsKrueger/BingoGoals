import { isPhotoId, type BingoBoard } from '@bingogoals/domain';
import { ApiError, createRequester, type FileBody } from '../api/http';
import type { ServerRecord } from '../store/boardStore';

/** Resultado de subir un cambio: guardado, o rechazado por uno más reciente. */
export type WriteOutcome =
  | {
      readonly status: 'saved';
      /** Fotos del tablero que el servidor todavía no tiene. */
      readonly missingPhotos: readonly string[];
    }
  | { readonly status: 'conflict'; readonly current: ServerRecord };

export interface BoardChanges {
  readonly boards: ServerRecord[];
  /** Lo que hay que enviar como `since` la próxima vez. */
  readonly cursor: string;
}

/** Lo que la sincronización necesita de la API de tableros y fotos. */
export interface BoardsApi {
  /** Tableros cambiados desde `since`, o todos si es null. */
  list(token: string, since: string | null): Promise<BoardChanges>;
  put(
    token: string,
    record: { board: BingoBoard; archivedAt: string | null },
  ): Promise<WriteOutcome>;
  remove(token: string, id: string, deletedAt: string): Promise<WriteOutcome>;
  /** Sube una foto. Subirla dos veces no es un error. */
  putPhoto(token: string, id: string, photo: FileBody): Promise<void>;
  /** Descarga una foto, o null si el servidor no la tiene. */
  getPhoto(token: string, id: string): Promise<FileBody | null>;
}

/**
 * La API gratuita puede tardar hasta un minuto en despertar: la
 * sincronización espera más que el resto de llamadas.
 */
const TIMEOUT_MS = 70_000;

function conflictOf(error: unknown): WriteOutcome {
  if (error instanceof ApiError && error.status === 409) {
    const current = (error.body as { current?: ServerRecord } | null)?.current;
    if (current) {
      return { status: 'conflict', current };
    }
  }
  throw error;
}

export function createBoardsApi(
  baseUrl: string,
  fetchFn: typeof fetch = fetch,
): BoardsApi {
  const request = createRequester(baseUrl, { fetchFn, timeoutMs: TIMEOUT_MS });

  return {
    list: (token, since) =>
      request<BoardChanges>(
        `/boards${since ? `?since=${encodeURIComponent(since)}` : ''}`,
        { method: 'GET', token },
      ),

    put: (token, record) =>
      request<{ missingPhotos?: unknown } | null>(
        `/boards/${record.board.id}`,
        { method: 'PUT', token, body: record },
      ).then(
        (body): WriteOutcome => ({
          status: 'saved',
          missingPhotos: Array.isArray(body?.missingPhotos)
            ? body.missingPhotos.filter(isPhotoId)
            : [],
        }),
        conflictOf,
      ),

    remove: (token, id, deletedAt) =>
      request<void>(
        `/boards/${id}?deletedAt=${encodeURIComponent(deletedAt)}`,
        { method: 'DELETE', token },
      ).then(
        (): WriteOutcome => ({ status: 'saved', missingPhotos: [] }),
        conflictOf,
      ),

    putPhoto: (token, id, photo) =>
      request<void>(`/photos/${id}`, { method: 'PUT', token, file: photo }),

    getPhoto: (token, id) =>
      request<FileBody>(`/photos/${id}`, {
        method: 'GET',
        token,
        expectFile: true,
      }).catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 404) {
          return null;
        }
        throw error;
      }),
  };
}
