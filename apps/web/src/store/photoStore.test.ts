// @vitest-environment node
import { describe, expect, test, vi } from 'vitest';
import { createMemoryStorage } from '../storage/memoryStorage';
import type { StoredPhoto } from '../storage/storage';
import { createPhotoStore, UNUSED_PHOTO_GRACE_MS } from './photoStore';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
const NOW = new Date('2026-10-27T12:00:00.000Z');

/** Deja que terminen las promesas pendientes. */
const settle = () => new Promise((resolve) => setTimeout(resolve));

function setup(storage = createMemoryStorage()) {
  const revokeUrl = vi.fn();
  const photos = createPhotoStore(storage.photos, {
    now: () => NOW,
    toUrl: (photo) => `url-${photo.id}`,
    revokeUrl,
  });
  return { storage, photos, revokeUrl };
}

function stored(overrides: Partial<StoredPhoto> = {}): StoredPhoto {
  return {
    id: crypto.randomUUID(),
    type: 'image/jpeg',
    bytes: JPEG.slice().buffer,
    savedAt: NOW.toISOString(),
    uploadedBy: null,
    ...overrides,
  };
}

const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

describe('añadir una foto', () => {
  test('la guarda en el dispositivo con un identificador nuevo', async () => {
    const { storage, photos } = setup();

    const id = await photos.add({ type: 'image/jpeg', bytes: JPEG.buffer });

    expect(storage.storedPhotos.get(id)).toMatchObject({
      id,
      type: 'image/jpeg',
      savedAt: NOW.toISOString(),
      uploadedBy: null,
    });
  });

  test('queda lista para mostrarse al momento', async () => {
    const { photos } = setup();
    const listener = vi.fn();
    photos.subscribe(listener);

    const id = await photos.add({ type: 'image/jpeg', bytes: JPEG.buffer });

    expect(photos.url(id)).toBe(`url-${id}`);
    expect(listener).toHaveBeenCalled();
  });

  test('si no se puede guardar, rechaza', async () => {
    const { storage, photos } = setup();
    storage.photos.put = async () => {
      throw new Error('Sin espacio.');
    };

    await expect(
      photos.add({ type: 'image/jpeg', bytes: JPEG.buffer }),
    ).rejects.toThrow();
  });
});

describe('mostrar una foto', () => {
  test('se carga del dispositivo cuando se pide', async () => {
    const storage = createMemoryStorage();
    const photo = stored();
    await storage.photos.put([photo]);
    const { photos } = setup(storage);

    expect(photos.url(photo.id)).toBeUndefined();
    photos.request(photo.id);
    await settle();

    expect(photos.url(photo.id)).toBe(`url-${photo.id}`);
  });

  test('una foto que no está en el dispositivo no tiene dirección', async () => {
    const { photos } = setup();
    const id = crypto.randomUUID();

    photos.request(id);
    await settle();

    expect(photos.url(id)).toBeUndefined();
  });

  test('aparece en cuanto otra pestaña la guarda', async () => {
    const storage = createMemoryStorage();
    const { photos } = setup(storage);
    const other = createPhotoStore(storage.openTab().photos);
    const id = crypto.randomUUID();
    photos.request(id);
    await settle();

    await other.addAll([stored({ id })]);
    await settle();

    expect(photos.url(id)).toBe(`url-${id}`);
  });

  test('aparece en cuanto se descarga del servidor', async () => {
    const { photos } = setup();
    const id = crypto.randomUUID();
    photos.request(id);
    await settle();

    await photos.saveDownloaded(
      id,
      { type: 'image/jpeg', bytes: JPEG.slice().buffer },
      'usuario-1',
    );

    expect(photos.url(id)).toBe(`url-${id}`);
    expect((await photos.get(id))?.uploadedBy).toBe('usuario-1');
  });

  test('una descarga que no es una foto se descarta', async () => {
    const { photos } = setup();
    const id = crypto.randomUUID();

    await photos.saveDownloaded(
      id,
      { type: 'image/jpeg', bytes: new TextEncoder().encode('<svg/>').buffer },
      'usuario-1',
    );

    expect(await photos.get(id)).toBeUndefined();
  });
});

describe('borrar las fotos sin uso', () => {
  test('borra las que no usa ninguna casilla y llevan más de un día', async () => {
    const storage = createMemoryStorage();
    const old = stored({ savedAt: ago(UNUSED_PHOTO_GRACE_MS + 1) });
    await storage.photos.put([old]);
    const { photos, revokeUrl } = setup(storage);
    photos.request(old.id);
    await settle();

    expect(await photos.collect(new Set())).toBe(1);

    expect(storage.storedPhotos.size).toBe(0);
    expect(photos.url(old.id)).toBeUndefined();
    expect(revokeUrl).toHaveBeenCalledWith(`url-${old.id}`);
  });

  test('conserva las que usa alguna casilla, por antiguas que sean', async () => {
    const storage = createMemoryStorage();
    const used = stored({ savedAt: ago(30 * UNUSED_PHOTO_GRACE_MS) });
    await storage.photos.put([used]);
    const { photos } = setup(storage);

    expect(await photos.collect(new Set([used.id]))).toBe(0);
    expect(storage.storedPhotos.has(used.id)).toBe(true);
  });

  test('conserva las recientes aunque aún no las use nadie', async () => {
    const storage = createMemoryStorage();
    const recent = stored({ savedAt: ago(60 * 60 * 1000) });
    await storage.photos.put([recent]);
    const { photos } = setup(storage);

    expect(await photos.collect(new Set())).toBe(0);
    expect(storage.storedPhotos.has(recent.id)).toBe(true);
  });
});
