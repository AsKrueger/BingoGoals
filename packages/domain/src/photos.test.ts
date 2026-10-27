import { describe, expect, test } from 'vitest';
import { createBoard, updateCell } from './board.js';
import { isPhotoId, photoIdsOf, photoTypeOf } from './photos.js';

const FIRST = '0b7c8f3e-5a2d-4c1b-9e6f-1a2b3c4d5e6f';
const SECOND = '9d4e2a1b-3c5f-4e6a-8b7c-0d1e2f3a4b5c';

function bytes(...values: number[]) {
  return new Uint8Array(values);
}

describe('photoTypeOf', () => {
  test('reconoce un JPEG por su contenido', () => {
    expect(photoTypeOf(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10))).toBe(
      'image/jpeg',
    );
  });

  test('reconoce un PNG', () => {
    expect(
      photoTypeOf(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0)),
    ).toBe('image/png');
  });

  test('reconoce un WebP', () => {
    const riff = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4];
    expect(photoTypeOf(bytes(...riff, 0x57, 0x45, 0x42, 0x50))).toBe(
      'image/webp',
    );
  });

  test.each([
    ['un GIF', [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
    ['un SVG', [0x3c, 0x73, 0x76, 0x67, 0x3e]],
    ['un RIFF que no es WebP', [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x41]],
    ['un archivo vacío', []],
  ])('rechaza %s', (_, values) => {
    expect(photoTypeOf(bytes(...values))).toBeNull();
  });
});

describe('isPhotoId', () => {
  test('admite un UUID', () => {
    expect(isPhotoId(FIRST)).toBe(true);
  });

  test.each([['foto.jpg'], [''], [null], [`${FIRST}/x`]])(
    'rechaza %s',
    (value) => {
      expect(isPhotoId(value)).toBe(false);
    },
  );
});

describe('photoIdsOf', () => {
  test('lista las fotos de las casillas sin repetir', () => {
    let board = createBoard('Metas', '3x3');
    board = updateCell(board, 0, { photoId: FIRST });
    board = updateCell(board, 4, { photoId: SECOND });
    board = updateCell(board, 8, { photoId: FIRST });

    expect(photoIdsOf(board)).toEqual([FIRST, SECOND]);
  });

  test('un tablero sin fotos no tiene ninguna', () => {
    expect(photoIdsOf(createBoard('Metas', '5x5'))).toEqual([]);
  });
});
