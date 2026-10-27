import type { BingoBoard } from '@bingogoals/domain';
import { ApiError, createRequester } from '../api/http';
import type { ServerRecord } from '../store/boardStore';

/** Resultado de subir un cambio: guardado, o rechazado por uno más reciente. */
export type WriteOutcome =
  | { readonly status: 'saved' }
  | { readonly status: 'conflict'; readonly current: ServerRecord };

export interface BoardChanges {
  readonly boards: ServerRecord[];
  /** Lo que hay que enviar como `since` la próxima vez. */
  readonly cursor: string;
}

/** Lo que la sincronización necesita de la API de tableros. */
export interface BoardsApi {
  /** Tableros cambiados desde `since`, o todos si es null. */
  list(token: string, since: string | null): Promise<BoardChanges>;
  put(
    token: string,
    record: { board: BingoBoard; archivedAt: string | null },
  ): Promise<WriteOutcome>;
  remove(token: string, id: string, deletedAt: string): Promise<WriteOutcome>;
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
      request<void>(`/boards/${record.board.id}`, {
        method: 'PUT',
        token,
        body: record,
      }).then((): WriteOutcome => ({ status: 'saved' }), conflictOf),

    remove: (token, id, deletedAt) =>
      request<void>(
        `/boards/${id}?deletedAt=${encodeURIComponent(deletedAt)}`,
        { method: 'DELETE', token },
      ).then((): WriteOutcome => ({ status: 'saved' }), conflictOf),
  };
}
