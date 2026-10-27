import { afterEach, describe, expect, test, vi } from 'vitest';
import { fitWithin, MAX_PHOTO_SIDE, resizePhoto } from './photos';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fitWithin', () => {
  test.each([
    ['apaisada', { width: 4000, height: 3000 }, { width: 1024, height: 768 }],
    ['vertical', { width: 3000, height: 4000 }, { width: 768, height: 1024 }],
    ['cuadrada', { width: 2048, height: 2048 }, { width: 1024, height: 1024 }],
    ['justa', { width: 1024, height: 500 }, { width: 1024, height: 500 }],
    ['muy alargada', { width: 5000, height: 2 }, { width: 1024, height: 1 }],
  ])('reduce una foto %s a un lado máximo de 1.024 px', (_, size, expected) => {
    expect(fitWithin(size, 1024)).toEqual(expected);
  });

  test('no amplía una foto pequeña', () => {
    expect(fitWithin({ width: 300, height: 200 }, 1024)).toEqual({
      width: 300,
      height: 200,
    });
  });
});

describe('resizePhoto', () => {
  /** Sustituye la decodificación y el lienzo, que jsdom no implementa. */
  function stubCanvas(width: number, height: number) {
    const bitmap = { width, height, close: vi.fn() };
    const context = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toBlob: vi.fn((done: (blob: Blob | null) => void) =>
        done(new Blob([new Uint8Array([0xff, 0xd8, 0xff])])),
      ),
    };
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => bitmap),
    );
    vi.spyOn(document, 'createElement').mockReturnValue(
      canvas as unknown as HTMLCanvasElement,
    );
    return { bitmap, context, canvas };
  }

  test('el lado máximo es de 1.024 px', () => {
    expect(MAX_PHOTO_SIDE).toBe(1024);
  });

  test('dibuja la foto reducida y la devuelve como archivo JPEG', async () => {
    const { bitmap, context, canvas } = stubCanvas(4000, 3000);

    const result = await resizePhoto(new Blob(['foto']));

    expect(result.type).toBe('image/jpeg');
    expect([...new Uint8Array(result.bytes)]).toEqual([0xff, 0xd8, 0xff]);
    expect([canvas.width, canvas.height]).toEqual([1024, 768]);
    expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1024, 768);
    expect(canvas.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/jpeg',
      0.85,
    );
    expect(bitmap.close).toHaveBeenCalled();
  });

  test('rechaza si el navegador no puede crear el JPEG', async () => {
    const { canvas, bitmap } = stubCanvas(640, 480);
    canvas.toBlob.mockImplementation((done) => done(null));

    await expect(resizePhoto(new Blob(['foto']))).rejects.toThrow();
    expect(bitmap.close).toHaveBeenCalled();
  });

  test('no amplía una foto que ya es pequeña', async () => {
    const { canvas } = stubCanvas(640, 480);

    await resizePhoto(new Blob(['foto']));

    expect([canvas.width, canvas.height]).toEqual([640, 480]);
  });

  test('rechaza un archivo que no es una imagen', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new Error('formato no admitido');
      }),
    );

    await expect(resizePhoto(new Blob(['texto']))).rejects.toThrow();
  });
});
