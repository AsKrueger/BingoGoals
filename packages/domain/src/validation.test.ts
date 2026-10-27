// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { createBoard, toggleCell, updateCell } from './board.js';
import {
  isBingoBoard,
  isBingoCell,
  isBingoSize,
  isBingoStyle,
  isCellsFor,
  isDateString,
  isValidTitle,
  MAX_TITLE_LENGTH,
} from './validation.js';

/** Copia modificable de un tablero válido, para estropearla en cada test. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function board(size: '3x3' | '5x5' = '3x3'): any {
  let valid = createBoard('Metas', size);
  valid = updateCell(valid, 0, {
    text: 'Correr 10 km',
    icon: '🏋️',
    color: '#2196F3',
    imagePath: 'data:image/jpeg;base64,AAAA',
  });
  return structuredClone(toggleCell(valid, 0));
}

describe('isBingoBoard', () => {
  test.each(['3x3', '5x5'] as const)('acepta un tablero %s válido', (size) => {
    expect(isBingoBoard(board(size))).toBe(true);
  });

  test('acepta un tablero tal como viene de JSON', () => {
    expect(isBingoBoard(JSON.parse(JSON.stringify(board())))).toBe(true);
  });

  test.each([
    ['undefined', undefined],
    ['null', null],
    ['un texto', 'tablero'],
    ['una lista', []],
    ['un objeto vacío', {}],
  ])('rechaza %s', (_, value) => {
    expect(isBingoBoard(value)).toBe(false);
  });

  test.each<[string, (value: ReturnType<typeof board>) => void]>([
    ['no tiene identificador', (value) => delete value.id],
    ['no tiene título', (value) => delete value.title],
    ['el título no es un texto', (value) => (value.title = 7)],
    ['el tamaño no existe', (value) => (value.size = '4x4')],
    ['faltan casillas para su tamaño', (value) => value.cells.pop()],
    [
      'sobran casillas para su tamaño',
      (value) => value.cells.push(value.cells[0]),
    ],
    ['las casillas no son una lista', (value) => (value.cells = {})],
    ['una casilla no es un objeto', (value) => (value.cells[2] = 'casilla')],
    ['no tiene estilo', (value) => delete value.style],
    ['el tema no existe', (value) => (value.style.theme = 'halloween')],
    [
      'la fecha de creación no es una fecha',
      (value) => (value.createdAt = 'ayer'),
    ],
    ['no tiene fecha de modificación', (value) => delete value.updatedAt],
    [
      'la fecha de modificación no es una fecha',
      (value) => (value.updatedAt = 12),
    ],
  ])('rechaza un tablero si %s', (_, corrupt) => {
    const value = board();
    corrupt(value);

    expect(isBingoBoard(value)).toBe(false);
  });

  test('en 5x5 exige 25 casillas', () => {
    const value = board('5x5');
    value.cells = value.cells.slice(0, 9);

    expect(isBingoBoard(value)).toBe(false);
  });
});

describe('isBingoCell', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cell = (): any => board().cells[0];

  test('acepta una casilla personalizada y una sin personalizar', () => {
    expect(isBingoCell(cell())).toBe(true);
    expect(isBingoCell(board().cells[1])).toBe(true);
  });

  test.each<[string, (value: ReturnType<typeof cell>) => void]>([
    ['no tiene identificador', (value) => delete value.id],
    ['el texto no es un texto', (value) => (value.text = null)],
    ['el estado no es un booleano', (value) => (value.isCompleted = 'sí')],
    ['falta la marca de estrella', (value) => delete value.isCentralStar],
    ['el icono no es un texto', (value) => (value.icon = 3)],
    ['el color no es un texto', (value) => (value.color = false)],
  ])('rechaza una casilla si %s', (_, corrupt) => {
    const value = cell();
    corrupt(value);

    expect(isBingoCell(value)).toBe(false);
  });
});

describe('foto de una casilla', () => {
  function cellWithPhoto(imagePath: unknown) {
    return { ...board().cells[0], imagePath };
  }

  test.each([
    'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    'data:image/png;base64,iVBORw0KGgo=',
    'data:image/webp;base64,UklGRg==',
    'data:image/gif;base64,R0lGODlh',
  ])('admite la URL de datos de imagen %s', (imagePath) => {
    expect(isBingoCell(cellWithPhoto(imagePath))).toBe(true);
  });

  test('admite una casilla sin foto', () => {
    expect(isBingoCell(cellWithPhoto(null))).toBe(true);
  });

  test.each([
    ['una dirección externa', 'https://example.com/foto.png'],
    ['una ruta de archivo', 'foto.jpg'],
    ['un texto vacío', ''],
    ['un número', 123],
    ['una URL de datos que no es imagen', 'data:text/html;base64,PGI+'],
    ['una imagen SVG', 'data:image/svg+xml;base64,PHN2Zz4='],
    ['una URL de datos sin base64', 'data:image/png,abc'],
    [
      'un texto que intenta salirse del url() de CSS',
      'data:image/png;base64,AAAA"), url("https://example.com/x',
    ],
    ['un script', 'javascript:alert(1)'],
  ])('rechaza %s', (_, imagePath) => {
    expect(isBingoCell(cellWithPhoto(imagePath))).toBe(false);
  });
});

describe('piezas sueltas', () => {
  test('isBingoSize solo admite los dos tamaños', () => {
    expect(isBingoSize('3x3')).toBe(true);
    expect(isBingoSize('5x5')).toBe(true);
    expect(isBingoSize('4x4')).toBe(false);
    expect(isBingoSize(3)).toBe(false);
  });

  test('isBingoStyle exige un tema conocido', () => {
    expect(isBingoStyle({ theme: 'sakura' })).toBe(true);
    expect(isBingoStyle({ theme: 'halloween' })).toBe(false);
    expect(isBingoStyle({})).toBe(false);
    expect(isBingoStyle(null)).toBe(false);
  });

  test('isCellsFor exige el número de casillas del tamaño', () => {
    expect(isCellsFor('3x3', board('3x3').cells)).toBe(true);
    expect(isCellsFor('5x5', board('5x5').cells)).toBe(true);
    expect(isCellsFor('5x5', board('3x3').cells)).toBe(false);
    expect(isCellsFor('3x3', 'casillas')).toBe(false);
  });

  test('isDateString admite fechas ISO y rechaza lo demás', () => {
    expect(isDateString('2026-10-11T08:00:00.000Z')).toBe(true);
    expect(isDateString('ayer')).toBe(false);
    expect(isDateString(1760000000000)).toBe(false);
    expect(isDateString(null)).toBe(false);
  });
});

describe('isValidTitle', () => {
  test.each(['Metas', 'Metas de 2027', 'a', 'x'.repeat(MAX_TITLE_LENGTH)])(
    'admite «%s»',
    (title) => {
      expect(isValidTitle(title)).toBe(true);
    },
  );

  test.each([
    ['vacío', ''],
    ['solo espacios', '   '],
    ['con espacios alrededor', ' Metas '],
    ['demasiado largo', 'x'.repeat(MAX_TITLE_LENGTH + 1)],
    ['que no es texto', 42],
    ['null', null],
  ])('rechaza un título %s', (_, title) => {
    expect(isValidTitle(title)).toBe(false);
  });
});
