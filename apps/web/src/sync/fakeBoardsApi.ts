import { MAX_PHOTO_BYTES, photoIdsOf, photoTypeOf } from '@bingogoals/domain';
import { ApiError, NetworkError, type FileBody } from '../api/http';
import type { FakeAccountApi } from '../account/fakeApi';
import type { ServerRecord } from '../store/boardStore';
import type { BoardsApi, WriteOutcome } from './boardsApi';

export interface FakeBoardsApi extends BoardsApi {
  /** Tableros guardados en el «servidor» para una cuenta, borrados incluidos. */
  stored(userId: string): ServerRecord[];
  /** Fotos guardadas en el «servidor» para una cuenta. */
  photos(userId: string): Map<string, FileBody>;
  /** Número de llamadas hechas, por método. */
  readonly calls: Record<
    'list' | 'put' | 'remove' | 'putPhoto' | 'getPhoto',
    number
  >;
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
  const photos = new Map<string, Map<string, FileBody>>();
  let seq = 0;
  const calls = { list: 0, put: 0, remove: 0, putPhoto: 0, getPhoto: 0 };

  function userOf(token: string): string {
    if (accounts.isDown) {
      throw new NetworkError();
    }
    return accounts.userFor(token).id;
  }

  function photosOf(userId: string): Map<string, FileBody> {
    let mine = photos.get(userId);
    if (!mine) {
      mine = new Map();
      photos.set(userId, mine);
    }
    return mine;
  }

  /** Como la API real: las fotos que ya no usa ningún tablero se borran. */
  function collect(userId: string) {
    const used = new Set(
      [...(boards.get(userId)?.values() ?? [])]
        .filter((entry) => entry.record.deletedAt === null)
        .flatMap((entry) => photoIdsOf(entry.record.board)),
    );
    const mine = photosOf(userId);
    for (const id of mine.keys()) {
      if (!used.has(id)) {
        mine.delete(id);
      }
    }
  }

  function missingFor(userId: string, ids: readonly string[]): string[] {
    const mine = photosOf(userId);
    return ids.filter((id) => !mine.has(id));
  }

  function ownerOf(
    token: string,
  ): Map<string, { record: ServerRecord; seq: number }> {
    const id = userOf(token);
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

    photos: photosOf,

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
      const userId = userOf(token);
      const incoming: ServerRecord = { board, archivedAt, deletedAt: null };
      const saved = (): WriteOutcome => ({
        status: 'saved',
        missingPhotos: missingFor(userId, photoIdsOf(board)),
      });
      const existing = mine.get(board.id)?.record;
      if (existing && version(existing) >= version(incoming)) {
        const same =
          existing.deletedAt === null &&
          JSON.stringify(existing) === JSON.stringify(incoming);
        return same
          ? saved()
          : { status: 'conflict', current: structuredClone(existing) };
      }
      save(mine, incoming);
      collect(userId);
      return saved();
    },

    async remove(token, id, deletedAt): Promise<WriteOutcome> {
      calls.remove++;
      const mine = ownerOf(token);
      const existing = mine.get(id)?.record;
      if (!existing || existing.deletedAt !== null) {
        return { status: 'saved', missingPhotos: [] };
      }
      if (version(existing) > Date.parse(deletedAt)) {
        return { status: 'conflict', current: structuredClone(existing) };
      }
      save(mine, {
        ...existing,
        board: { ...existing.board, updatedAt: deletedAt },
        deletedAt,
      });
      collect(userOf(token));
      return { status: 'saved', missingPhotos: [] };
    },

    async putPhoto(token, id, photo) {
      calls.putPhoto++;
      const userId = userOf(token);
      const type = photoTypeOf(new Uint8Array(photo.bytes));
      if (!type || photo.bytes.byteLength > MAX_PHOTO_BYTES) {
        throw new ApiError(400, 'La foto no es válida.');
      }
      const mine = photosOf(userId);
      if (!mine.has(id)) {
        mine.set(id, { type, bytes: photo.bytes.slice(0) });
      }
    },

    async getPhoto(token, id) {
      calls.getPhoto++;
      const photo = photosOf(userOf(token)).get(id);
      return photo ? { type: photo.type, bytes: photo.bytes.slice(0) } : null;
    },
  };
}
