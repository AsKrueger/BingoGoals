import {
  EMPTY_COLLECTION,
  EMPTY_HISTORY,
  type BoardCollection,
  type BoardHistory,
} from '../domain';

/** Todo lo que la web guarda en el dispositivo. */
export interface AppData {
  readonly collection: BoardCollection;
  readonly history: BoardHistory;
}

export const EMPTY_DATA: AppData = {
  collection: EMPTY_COLLECTION,
  history: EMPTY_HISTORY,
};

/**
 * Dónde se guardan los datos. Las pantallas solo conocen esta interfaz, así
 * que la implementación se puede sustituir sin tocarlas: hoy es IndexedDB y
 * en la fase 2 será la sincronización con la API.
 */
export interface BoardStorage {
  /** Devuelve null si no hay datos guardados o no se pueden leer. */
  load(): Promise<AppData | null>;
  save(data: AppData): Promise<void>;
}
