import type { BingoBoard } from '@bingogoals/domain';
import { recordVersion } from '../storage/records';
import type {
  AppData,
  BoardStorage,
  LocalData,
  LocalRecord,
  StorageChanges,
} from '../storage/storage';

/** Un tablero tal como lo devuelve la API. */
export interface ServerRecord {
  readonly board: BingoBoard;
  readonly archivedAt: string | null;
  readonly deletedAt: string | null;
}

export interface StoreSnapshot {
  /** Lo que muestran las pantallas. */
  readonly data: AppData;
  /** Cuenta con sesión iniciada, o null. */
  readonly viewerId: string | null;
  /** Tableros de esa cuenta con cambios que el servidor no tiene aún. */
  readonly pendingCount: number;
  /** true si el último intento de guardar en el dispositivo falló. */
  readonly saveError: boolean;
}

export interface BoardStore {
  getSnapshot(): StoreSnapshot;
  subscribe(listener: () => void): () => void;
  /** Aplica un cambio hecho por el usuario y lo guarda en el dispositivo. */
  update(producer: (data: AppData) => AppData): void;
  /**
   * Incorpora tableros recibidos del servidor. Gana la versión más reciente;
   * con `force`, gana siempre la del servidor (tras un conflicto).
   */
  mergeRemote(
    records: readonly ServerRecord[],
    ownerId: string,
    options?: { force?: boolean },
  ): void;
  /** Anota que el servidor ya tiene esa versión de un tablero. */
  markSynced(id: string, version: string): void;
  /** Tableros de una cuenta que el servidor todavía no tiene. */
  pendingFor(userId: string): LocalRecord[];
  /** Todos los tableros guardados en el dispositivo, de cualquier cuenta. */
  localRecords(): LocalRecord[];
  /**
   * Cambia la cuenta con sesión. Los tableros creados sin cuenta pasan a ser
   * de ella, y se subirán.
   */
  setViewer(userId: string | null): void;
  /** Quita del dispositivo los tableros de una cuenta, sin borrarlos del servidor. */
  removeOwner(userId: string): void;
  /** Los tableros de una cuenta borrada pasan a ser de este dispositivo. */
  releaseOwner(userId: string): void;
  cursorFor(userId: string): string | null;
  setCursor(userId: string, cursor: string): void;
  /** Añade tableros recuperados de una copia, como si se acabaran de crear. */
  importBoards(data: AppData): number;
  /** Vuelve a intentar los guardados que fallaron. */
  retrySave(): void;
  /** Avisa de cada cambio hecho por el usuario en esta pestaña. */
  onLocalChange(listener: () => void): () => void;
  dispose(): void;
}

interface Entry {
  board: BingoBoard;
  archivedAt: string | null;
}

interface Batch {
  put: Map<string, LocalRecord>;
  remove: Set<string>;
  activeBoardId?: string | null;
  cursors: Map<string, string>;
}

function emptyBatch(): Batch {
  return { put: new Map(), remove: new Set(), cursors: new Map() };
}

/** Junta dos lotes de cambios; lo de `newer` manda sobre lo de `older`. */
function mergeBatches(older: Batch, newer: Batch | null): Batch {
  const result: Batch = {
    put: new Map(older.put),
    remove: new Set(older.remove),
    activeBoardId: older.activeBoardId,
    cursors: new Map(older.cursors),
  };
  if (!newer) {
    return result;
  }
  for (const [id, record] of newer.put) {
    result.put.set(id, record);
    result.remove.delete(id);
  }
  for (const id of newer.remove) {
    result.remove.add(id);
    result.put.delete(id);
  }
  if (newer.activeBoardId !== undefined) {
    result.activeBoardId = newer.activeBoardId;
  }
  for (const [userId, cursor] of newer.cursors) {
    result.cursors.set(userId, cursor);
  }
  return result;
}

function toChanges(batch: Batch): StorageChanges {
  const [cursor] = [...batch.cursors];
  return {
    put: [...batch.put.values()],
    remove: [...batch.remove],
    ...(batch.activeBoardId !== undefined && {
      activeBoardId: batch.activeBoardId,
    }),
    ...(cursor && { syncCursor: { userId: cursor[0], cursor: cursor[1] } }),
  };
}

function entriesOf(data: AppData): Map<string, Entry> {
  return new Map<string, Entry>([
    ...data.collection.boards.map((board): [string, Entry] => [
      board.id,
      { board, archivedAt: null },
    ]),
    ...data.history.map((entry): [string, Entry] => [
      entry.board.id,
      { board: entry.board, archivedAt: entry.archivedAt },
    ]),
  ]);
}

/**
 * Estado de los tableros de esta pestaña. Las pantallas lo leen y lo cambian
 * con `update`; el almacén decide qué tableros han cambiado, los guarda en el
 * dispositivo uno a uno y los marca como pendientes de subir.
 */
export function createBoardStore(
  storage: BoardStorage,
  initial: LocalData,
  { now = () => new Date() }: { now?: () => Date } = {},
): BoardStore {
  const records = new Map<string, LocalRecord>(
    initial.records.map((record) => [record.board.id, record]),
  );
  let activeBoardId = initial.activeBoardId;
  const cursors = new Map(Object.entries(initial.syncCursors));
  let viewerId: string | null = null;
  let saveError = false;

  const listeners = new Set<() => void>();
  const localListeners = new Set<() => void>();

  let queued: Batch | null = null;
  let isSaving = false;

  function isVisible(record: LocalRecord): boolean {
    return (
      record.deletedAt === null &&
      (viewerId === null ||
        record.ownerId === null ||
        record.ownerId === viewerId)
    );
  }

  function build(): StoreSnapshot {
    const visible = [...records.values()].filter(isVisible);
    const boards = visible
      .filter((record) => record.archivedAt === null)
      .map((record) => record.board)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const history = visible
      .filter((record) => record.archivedAt !== null)
      .map((record) => ({
        board: record.board,
        archivedAt: record.archivedAt as string,
      }))
      .sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
    const active = boards.some((board) => board.id === activeBoardId)
      ? activeBoardId
      : (boards[0]?.id ?? null);

    return {
      data: { collection: { boards, activeBoardId: active }, history },
      viewerId,
      pendingCount: viewerId
        ? [...records.values()].filter(
            (record) => record.pending && record.ownerId === viewerId,
          ).length
        : 0,
      saveError,
    };
  }

  let snapshot = build();

  function emit() {
    snapshot = build();
    for (const listener of listeners) {
      listener();
    }
  }

  async function flush() {
    if (isSaving || !queued) {
      return;
    }
    isSaving = true;
    const batch = queued;
    queued = null;
    try {
      await storage.apply(toChanges(batch));
      saveError = false;
    } catch {
      // Se conserva lo que no se pudo guardar, para el siguiente intento.
      saveError = true;
      queued = mergeBatches(batch, queued);
    } finally {
      isSaving = false;
      emit();
    }
    if (queued && !saveError) {
      void flush();
    }
  }

  function save(batch: Batch) {
    queued = queued ? mergeBatches(queued, batch) : batch;
    void flush();
  }

  function put(batch: Batch, record: LocalRecord) {
    records.set(record.board.id, record);
    batch.put.set(record.board.id, record);
  }

  function drop(batch: Batch, id: string) {
    records.delete(id);
    batch.remove.add(id);
  }

  // Cambios guardados por otras pestañas: gana la versión más reciente.
  const unsubscribe = storage.subscribe((changes) => {
    for (const record of changes.put ?? []) {
      const local = records.get(record.board.id);
      if (!local || recordVersion(record) >= recordVersion(local)) {
        records.set(record.board.id, record);
      }
    }
    for (const id of changes.remove ?? []) {
      records.delete(id);
    }
    emit();
  });

  return {
    getSnapshot: () => snapshot,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    update(producer) {
      const previous = snapshot.data;
      const next = producer(previous);
      if (next === previous) {
        return;
      }
      const stamp = now().toISOString();
      const batch = emptyBatch();
      const before = entriesOf(previous);
      const after = entriesOf(next);

      for (const [id, entry] of after) {
        const old = before.get(id);
        if (old?.board === entry.board && old.archivedAt === entry.archivedAt) {
          continue;
        }
        // Archivar no cambia el tablero, pero sí es una versión nueva.
        const board =
          old?.board === entry.board
            ? { ...entry.board, updatedAt: stamp }
            : entry.board;
        put(batch, {
          board,
          archivedAt: entry.archivedAt,
          deletedAt: null,
          ownerId: records.get(id)?.ownerId ?? viewerId,
          pending: true,
        });
      }

      for (const id of before.keys()) {
        const record = records.get(id);
        if (after.has(id) || !record) {
          continue;
        }
        if (record.ownerId === null) {
          // Nunca ha estado en el servidor: no hace falta avisarle.
          drop(batch, id);
        } else {
          put(batch, {
            ...record,
            board: { ...record.board, updatedAt: stamp },
            deletedAt: stamp,
            pending: true,
          });
        }
      }

      if (next.collection.activeBoardId !== previous.collection.activeBoardId) {
        activeBoardId = next.collection.activeBoardId;
        batch.activeBoardId = activeBoardId;
      }

      save(batch);
      emit();
      for (const listener of localListeners) {
        listener();
      }
    },

    mergeRemote(incoming, ownerId, { force = false } = {}) {
      const batch = emptyBatch();
      for (const remote of incoming) {
        const id = remote.board.id;
        const local = records.get(id);
        if (local && !force) {
          // Un cambio local pendiente igual o más reciente se respeta: al
          // subirlo, el servidor decide.
          if (local.pending && recordVersion(local) >= recordVersion(remote)) {
            continue;
          }
          if (
            !local.pending &&
            recordVersion(local) === recordVersion(remote) &&
            local.deletedAt === remote.deletedAt
          ) {
            continue;
          }
        }
        if (remote.deletedAt !== null) {
          if (local) {
            drop(batch, id);
          }
          continue;
        }
        put(batch, {
          board: remote.board,
          archivedAt: remote.archivedAt,
          deletedAt: null,
          ownerId,
          pending: false,
        });
      }
      if (batch.put.size > 0 || batch.remove.size > 0) {
        save(batch);
        emit();
      }
    },

    markSynced(id, version) {
      const record = records.get(id);
      if (!record || record.board.updatedAt !== version || !record.pending) {
        // Ha vuelto a cambiar mientras se subía: sigue pendiente.
        return;
      }
      const batch = emptyBatch();
      if (record.deletedAt !== null) {
        drop(batch, id);
      } else {
        put(batch, { ...record, pending: false });
      }
      save(batch);
      emit();
    },

    pendingFor(userId) {
      return [...records.values()].filter(
        (record) => record.pending && record.ownerId === userId,
      );
    },

    localRecords: () => [...records.values()],

    setViewer(userId) {
      viewerId = userId;
      if (userId) {
        const batch = emptyBatch();
        for (const record of records.values()) {
          if (record.ownerId === null) {
            put(batch, { ...record, ownerId: userId, pending: true });
          }
        }
        if (batch.put.size > 0) {
          save(batch);
          for (const listener of localListeners) {
            listener();
          }
        }
      }
      emit();
    },

    removeOwner(userId) {
      const batch = emptyBatch();
      for (const record of [...records.values()]) {
        if (record.ownerId === userId) {
          drop(batch, record.board.id);
        }
      }
      save(batch);
      emit();
    },

    releaseOwner(userId) {
      const batch = emptyBatch();
      for (const record of [...records.values()]) {
        if (record.ownerId !== userId) {
          continue;
        }
        if (record.deletedAt !== null) {
          drop(batch, record.board.id);
        } else {
          put(batch, { ...record, ownerId: null, pending: false });
        }
      }
      save(batch);
      emit();
    },

    cursorFor: (userId) => cursors.get(userId) ?? null,

    setCursor(userId, cursor) {
      cursors.set(userId, cursor);
      const batch = emptyBatch();
      batch.cursors.set(userId, cursor);
      save(batch);
    },

    importBoards(data) {
      const batch = emptyBatch();
      for (const [id, entry] of entriesOf(data)) {
        if (records.has(id)) {
          continue;
        }
        put(batch, {
          board: entry.board,
          archivedAt: entry.archivedAt,
          deletedAt: null,
          ownerId: viewerId,
          pending: true,
        });
      }
      if (batch.put.size > 0) {
        save(batch);
        emit();
        for (const listener of localListeners) {
          listener();
        }
      }
      return batch.put.size;
    },

    retrySave() {
      saveError = false;
      void flush();
    },

    onLocalChange(listener) {
      localListeners.add(listener);
      return () => localListeners.delete(listener);
    },

    dispose() {
      unsubscribe();
    },
  };
}
