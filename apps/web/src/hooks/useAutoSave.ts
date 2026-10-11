import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppData, BoardStorage } from '../storage/storage';

/**
 * Guarda los datos cada vez que cambian. Si guardar falla, lo indica en
 * `saveError` y permite reintentarlo; lo que hay en pantalla no se pierde.
 */
export function useAutoSave(storage: BoardStorage, data: AppData) {
  const [saveError, setSaveError] = useState(false);
  // Últimos datos entregados al almacenamiento. Empieza con los cargados,
  // así que no se guarda nada hasta el primer cambio.
  const lastData = useRef(data);
  // Solo cuenta el resultado del guardado más reciente.
  const lastSave = useRef(0);

  const save = useCallback(
    (dataToSave: AppData) => {
      const current = ++lastSave.current;
      storage.save(dataToSave).then(
        () => current === lastSave.current && setSaveError(false),
        () => current === lastSave.current && setSaveError(true),
      );
    },
    [storage],
  );

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
