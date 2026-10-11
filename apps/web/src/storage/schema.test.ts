// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { parseStoredData, STORAGE_VERSION, toStoredData } from './schema';
import { EMPTY_DATA } from './storage';
import { sampleData } from './testData';

/** Copia modificable de los datos guardados, para estropearlos en cada test. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stored(): any {
  return structuredClone(toStoredData(sampleData()));
}

describe('toStoredData', () => {
  test('añade el número de versión a los datos', () => {
    const data = sampleData();

    expect(toStoredData(data)).toEqual({ version: STORAGE_VERSION, ...data });
    expect(STORAGE_VERSION).toBe(1);
  });
});

describe('parseStoredData', () => {
  test('recupera exactamente lo que se guardó', () => {
    const data = sampleData();

    expect(parseStoredData(structuredClone(toStoredData(data)))).toEqual(data);
  });

  test('acepta unos datos vacíos', () => {
    expect(parseStoredData(toStoredData(EMPTY_DATA))).toEqual(EMPTY_DATA);
  });

  test.each([
    ['nada guardado', undefined],
    ['null', null],
    ['un texto', 'hola'],
    ['un número', 42],
    ['una lista', []],
    ['un objeto vacío', {}],
  ])('rechaza %s', (_, raw) => {
    expect(parseStoredData(raw)).toBeNull();
  });

  test.each([0, 2, 99, '1', null, undefined])(
    'rechaza la versión desconocida %s',
    (version) => {
      expect(parseStoredData({ ...stored(), version })).toBeNull();
    },
  );

  test.each<[string, (data: ReturnType<typeof stored>) => void]>([
    ['falta la colección', (data) => delete data.collection],
    ['falta el historial', (data) => delete data.history],
    ['el historial no es una lista', (data) => (data.history = {})],
    ['los tableros no son una lista', (data) => (data.collection.boards = 5)],
    [
      'el tablero activo no existe',
      (data) => (data.collection.activeBoardId = 'otro'),
    ],
    [
      'hay tableros pero ninguno activo',
      (data) => (data.collection.activeBoardId = null),
    ],
    [
      'un tablero no tiene título',
      (data) => delete data.collection.boards[0].title,
    ],
    ['el tamaño no existe', (data) => (data.collection.boards[0].size = '4x4')],
    [
      'faltan casillas para su tamaño',
      (data) => data.collection.boards[0].cells.pop(),
    ],
    [
      'una casilla no es un objeto',
      (data) => (data.collection.boards[0].cells[2] = 'casilla'),
    ],
    [
      'el estado de una casilla no es un booleano',
      (data) => (data.collection.boards[0].cells[2].isCompleted = 'sí'),
    ],
    [
      'la foto de una casilla no es un texto',
      (data) => (data.collection.boards[0].cells[2].imagePath = 123),
    ],
    [
      'el tema no existe',
      (data) => (data.collection.boards[1].style.theme = 'halloween'),
    ],
    [
      'la fecha de creación no es una fecha',
      (data) => (data.collection.boards[1].createdAt = 'ayer'),
    ],
    [
      'un archivado no tiene fecha de archivo',
      (data) => delete data.history[0].archivedAt,
    ],
    [
      'el tablero de un archivado está corrupto',
      (data) => (data.history[0].board.cells = []),
    ],
  ])('rechaza los datos si %s', (_, corrupt) => {
    const data = stored();
    corrupt(data);

    expect(parseStoredData(data)).toBeNull();
  });
});
