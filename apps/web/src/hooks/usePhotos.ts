import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
} from 'react';
import type { PhotoStore } from '../store/photoStore';

/** Las fotos de las casillas. Sin él, las casillas se muestran sin foto. */
export const PhotoContext = createContext<PhotoStore | null>(null);

const noSubscription = () => () => {};

export function usePhotos(): PhotoStore | null {
  return useContext(PhotoContext);
}

/**
 * Dirección para mostrar una foto, o undefined mientras no está en el
 * dispositivo: todavía se está cargando o no ha llegado del servidor.
 */
export function usePhotoUrl(id: string | null): string | undefined {
  const photos = usePhotos();

  useEffect(() => {
    if (photos && id) {
      photos.request(id);
    }
  }, [photos, id]);

  return useSyncExternalStore(photos?.subscribe ?? noSubscription, () =>
    photos && id ? photos.url(id) : undefined,
  );
}
