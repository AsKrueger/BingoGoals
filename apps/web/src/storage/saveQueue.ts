import type { AppData, BoardStorage } from './storage';

/**
 * Guarda de uno en uno. Si llegan datos mientras hay un guardado en curso,
 * esperan a que termine; de los que esperan solo se guarda el último, porque
 * cada guardado contiene todo el estado.
 *
 * Sin esta cola, dos guardados seguidos podrían terminar en orden inverso y
 * dejar guardado el estado antiguo.
 *
 * `onResult` recibe si el último guardado funcionó, una vez que no queda
 * ninguno pendiente.
 */
export function createSaveQueue(
  storage: BoardStorage,
  onResult: (succeeded: boolean) => void,
) {
  let isSaving = false;
  let pending: AppData | null = null;

  async function run(data: AppData): Promise<void> {
    isSaving = true;
    let succeeded = true;
    try {
      await storage.save(data);
    } catch {
      succeeded = false;
    }
    isSaving = false;

    if (pending) {
      const next = pending;
      pending = null;
      void run(next);
    } else {
      onResult(succeeded);
    }
  }

  return function save(data: AppData) {
    if (isSaving) {
      pending = data;
    } else {
      void run(data);
    }
  };
}
