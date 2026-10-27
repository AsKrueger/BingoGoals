import { useEffect, useRef, useState } from 'react';

/**
 * Qué ha respondido el navegador al pedirle que no borre los datos:
 * - `persisted`: no los borrará aunque le falte espacio.
 * - `denied`: puede borrarlos si le falta espacio.
 * - `unsupported`: no permite pedirlo.
 */
export type Persistence = 'persisted' | 'denied' | 'unsupported';

/** Lo mínimo de `navigator.storage` que hace falta. */
type StorageManagerLike = Pick<StorageManager, 'persist' | 'persisted'>;

/**
 * Pide al navegador que no borre los datos de la web cuando le falte
 * espacio. Algunos navegadores preguntan al usuario; otros deciden solos,
 * por ejemplo según si la web está instalada.
 */
export async function requestPersistentStorage(
  storage: StorageManagerLike | undefined = globalThis.navigator?.storage,
): Promise<Persistence> {
  if (!storage?.persist || !storage.persisted) {
    return 'unsupported';
  }
  try {
    if ((await storage.persisted()) || (await storage.persist())) {
      return 'persisted';
    }
    return 'denied';
  } catch {
    return 'unsupported';
  }
}

/**
 * Pide el almacenamiento persistente en cuanto hay algo que guardar, para no
 * preguntar a quien solo está mirando. Devuelve la respuesta del navegador,
 * o null mientras no se ha pedido.
 */
export function usePersistentStorage(
  hasData: boolean,
  request: () => Promise<Persistence> = requestPersistentStorage,
): Persistence | null {
  const requested = useRef(false);
  const [persistence, setPersistence] = useState<Persistence | null>(null);

  useEffect(() => {
    if (!hasData || requested.current) {
      return;
    }
    requested.current = true;
    request()
      .then(setPersistence)
      .catch(() => setPersistence('unsupported'));
  }, [hasData, request]);

  return persistence;
}
