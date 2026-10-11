import { readStoredData, toStoredData } from './schema';
import type { AppData, BoardStorage, LoadResult } from './storage';

export interface MemoryStorage extends BoardStorage {
  /** Lo guardado tal cual, o lo que se quiera simular que hay guardado. */
  raw: unknown;
  /** Copias de los registros ilegibles que se han sobrescrito. */
  readonly unreadableCopies: unknown[];
  /** Si es true, guardar falla, como cuando no queda espacio. */
  failOnSave: boolean;
  /** Si es true, cargar falla, como cuando el almacenamiento no está disponible. */
  failOnLoad: boolean;
}

/**
 * Almacenamiento en memoria con el mismo comportamiento que el real: copia
 * los datos al guardar, los valida al cargar y conserva una copia de lo
 * ilegible antes de sobrescribirlo. Sirve para los tests.
 */
export function createMemoryStorage(raw: unknown = undefined): MemoryStorage {
  return {
    raw,
    unreadableCopies: [],
    failOnSave: false,
    failOnLoad: false,

    async load(): Promise<LoadResult> {
      if (this.failOnLoad) {
        throw new Error('No se puede leer el almacenamiento.');
      }
      return readStoredData(this.raw);
    },
    async save(data: AppData): Promise<void> {
      if (this.failOnSave) {
        throw new Error('No queda espacio en el dispositivo.');
      }
      if (readStoredData(this.raw).status === 'unreadable') {
        this.unreadableCopies.push(this.raw);
      }
      this.raw = structuredClone(toStoredData(data));
    },
  };
}
