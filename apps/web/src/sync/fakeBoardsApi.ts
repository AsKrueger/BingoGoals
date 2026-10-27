import { NetworkError } from '../api/http';
import type { FakeAccountApi } from '../account/fakeApi';
import type { ServerRecord } from '../store/boardStore';
import type { BoardsApi, WriteOutcome } from './boardsApi';

export interface FakeBoardsApi extends BoardsApi {
  /** Tableros guardados en el «servidor» para una cuenta, borrados incluidos. */
  stored(userId: string): ServerRecord[];
  /** Número de llamadas hechas, por método. */
  readonly calls: Record<'list' | 'put' | 'remove', number>;
}

const version = (record: ServerRecord) => Date.parse(record.board.updatedAt);

/**
 * API de tableros en memoria, con las mismas reglas que la real: cada
 * usuario solo ve los suyos y gana la versión más reciente. Usa las sesiones
 * y el «apagado» de la API de cuentas falsa.
 */
export function createFakeBoardsApi(accounts: FakeAccountApi): FakeBoardsApi {
  /** Por usuario: tableros y el orden en que cambiaron. */
  const boards = new Map<
    string,
    Map<string, { record: ServerRecord; seq: number }>
  >();
  let seq = 0;
  const calls = { list: 0, put: 0, remove: 0 };

  function ownerOf(
    token: string,
  ): Map<string, { record: ServerRecord; seq: number }> {
    if (accounts.isDown) {
      throw new NetworkError();
    }
    const { id } = accounts.userFor(token);
    let mine = boards.get(id);
    if (!mine) {
      mine = new Map();
      boards.set(id, mine);
    }
    return mine;
  }

  function save(
    mine: Map<string, { record: ServerRecord; seq: number }>,
    record: ServerRecord,
  ) {
    mine.set(record.board.id, { record: structuredClone(record), seq: ++seq });
  }

  return {
    calls,

    stored: (userId) =>
      [...(boards.get(userId)?.values() ?? [])].map((entry) => entry.record),

    async list(token, since) {
      calls.list++;
      const mine = ownerOf(token);
      const from = since === null ? 0 : Number(since);
      return {
        boards: [...mine.values()]
          .filter((entry) => entry.seq > from)
          .map((entry) => structuredClone(entry.record)),
        cursor: String(seq),
      };
    },

    async put(token, { board, archivedAt }): Promise<WriteOutcome> {
      calls.put++;
      const mine = ownerOf(token);
      const incoming: ServerRecord = { board, archivedAt, deletedAt: null };
      const existing = mine.get(board.id)?.record;
      if (existing && version(existing) >= version(incoming)) {
        const same =
          existing.deletedAt === null &&
          JSON.stringify(existing) === JSON.stringify(incoming);
        return same
          ? { status: 'saved' }
          : { status: 'conflict', current: structuredClone(existing) };
      }
      save(mine, incoming);
      return { status: 'saved' };
    },

    async remove(token, id, deletedAt): Promise<WriteOutcome> {
      calls.remove++;
      const mine = ownerOf(token);
      const existing = mine.get(id)?.record;
      if (!existing || existing.deletedAt !== null) {
        return { status: 'saved' };
      }
      if (version(existing) > Date.parse(deletedAt)) {
        return { status: 'conflict', current: structuredClone(existing) };
      }
      save(mine, {
        ...existing,
        board: { ...existing.board, updatedAt: deletedAt },
        deletedAt,
      });
      return { status: 'saved' };
    },
  };
}
