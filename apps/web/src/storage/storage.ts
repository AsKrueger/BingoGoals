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
 * Resultado de leer lo guardado. «Sin datos» y «datos ilegibles» son casos
 * distintos: en el segundo hay algo guardado que no se debe perder.
 */
export type LoadResult =
  /** No hay nada guardado: es la primera visita o se borraron los datos. */
  | { readonly status: 'empty' }
  | { readonly status: 'loaded'; readonly data: AppData }
  /** Hay algo guardado, pero está corrupto o es de una versión desconocida. */
  | { readonly status: 'unreadable' };

/**
 * Dónde se guardan los datos. Las pantallas solo conocen esta interfaz, así
 * que la implementación se puede sustituir sin tocarlas: hoy es IndexedDB y
 * en la fase 2 será la sincronización con la API.
 */
export interface BoardStorage {
  /** Rechaza si el almacenamiento no está disponible. */
  load(): Promise<LoadResult>;
  /**
   * Sustituye lo guardado. Si lo que había era ilegible, antes conserva una
   * copia: los datos ilegibles no se borran nunca de forma automática.
   */
  save(data: AppData): Promise<void>;
}
