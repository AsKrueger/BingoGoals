import { useEffect, useRef, useState } from 'react';
import { createSaveQueue } from '../storage/saveQueue';
import type { AppData, BoardStorage } from '../storage/storage';

/**
 * Guarda los datos cada vez que cambian. Si guardar falla, lo indica en
 * `saveError` y permite reintentarlo; lo que hay en pantalla no se pierde.
 */
export function useAutoSave(storage: BoardStorage, data: AppData) {
  const [saveError, setSaveError] = useState(false);
  // Los guardados van de uno en uno, para que nunca gane uno antiguo.
  const [save] = useState(() =>
    createSaveQueue(storage, (succeeded) => setSaveError(!succeeded)),
  );
  // Últimos datos entregados al almacenamiento. Empieza con los cargados,
  // así que no se guarda nada hasta el primer cambio.
  const lastData = useRef(data);

  useEffect(() => {
    if (lastData.current !== data) {
      lastData.current = data;
      save(data);
    }
  }, [data, save]);

  return {
    saveError,
    retrySave: () => save(lastData.current),
  };
}
