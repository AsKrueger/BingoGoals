import { parseStoredData, toStoredData } from './schema';
import type { AppData, BoardStorage } from './storage';

export interface MemoryStorage extends BoardStorage {
  /** Lo guardado tal cual, o lo que se quiera simular que hay guardado. */
  raw: unknown;
  /** Si es true, guardar falla, como cuando no queda espacio. */
  failOnSave: boolean;
  /** Si es true, cargar falla, como cuando el almacenamiento no está disponible. */
  failOnLoad: boolean;
}

/**
 * Almacenamiento en memoria con el mismo comportamiento que el real: copia
 * los datos al guardar y los valida al cargar. Sirve para los tests.
 */
export function createMemoryStorage(raw: unknown = undefined): MemoryStorage {
  return {
    raw,
    failOnSave: false,
    failOnLoad: false,

    async load(): Promise<AppData | null> {
      if (this.failOnLoad) {
        throw new Error('No se puede leer el almacenamiento.');
      }
      return parseStoredData(this.raw);
    },
    async save(data: AppData): Promise<void> {
      if (this.failOnSave) {
        throw new Error('No queda espacio en el dispositivo.');
      }
      this.raw = structuredClone(toStoredData(data));
    },
  };
}
