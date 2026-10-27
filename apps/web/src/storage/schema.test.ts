// @vitest-environment node
import { describe, expect, test } from 'vitest';
import {
  parseStoredData,
  readLegacyRecord,
  RECORD_VERSION,
  toStoredData,
} from './schema';
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

    expect(toStoredData(data)).toEqual({ version: RECORD_VERSION, ...data });
    expect(RECORD_VERSION).toBe(2);
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

  test.each([0, 3, 99, '2', null, undefined])(
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

// Hallazgo 5 de la revisión de la fase 1.
describe('foto de una casilla', () => {
  function withPhoto(imagePath: unknown) {
    const data = stored();
    data.collection.boards[0].cells[2].imagePath = imagePath;
    return data;
  }

  test.each([
    'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    'data:image/png;base64,iVBORw0KGgo=',
    'data:image/webp;base64,UklGRg==',
    'data:image/gif;base64,R0lGODlh',
  ])('admite la URL de datos de imagen %s', (imagePath) => {
    expect(parseStoredData(withPhoto(imagePath))).not.toBeNull();
  });

  test('admite una casilla sin foto', () => {
    expect(parseStoredData(withPhoto(null))).not.toBeNull();
  });

  test.each([
    ['una dirección externa', 'https://example.com/foto.png'],
    ['una ruta de archivo', 'foto.jpg'],
    ['un texto vacío', ''],
    ['una URL de datos que no es imagen', 'data:text/html;base64,PGI+'],
    ['una imagen SVG', 'data:image/svg+xml;base64,PHN2Zz4='],
    ['una URL de datos sin base64', 'data:image/png,abc'],
    [
      'un texto que intenta salirse del url() de CSS',
      'data:image/png;base64,AAAA"), url("https://example.com/x',
    ],
    ['un script', 'javascript:alert(1)'],
  ])('rechaza %s', (_, imagePath) => {
    expect(parseStoredData(withPhoto(imagePath))).toBeNull();
  });
});

// Hallazgo 1 de la revisión de la fase 1.
describe('readLegacyRecord', () => {
  test('sin registro, no hay datos', () => {
    expect(readLegacyRecord(undefined)).toEqual({ status: 'empty' });
  });

  test('con un registro válido, devuelve los datos', () => {
    const data = sampleData();

    expect(readLegacyRecord(structuredClone(toStoredData(data)))).toEqual({
      status: 'loaded',
      data,
    });
  });

  test.each([
    ['null', null],
    ['un texto', 'esto no son datos'],
    ['un objeto vacío', {}],
    ['una versión más nueva', { ...toStoredData(sampleData()), version: 3 }],
  ])('con %s, hay datos pero son ilegibles', (_, raw) => {
    expect(readLegacyRecord(raw)).toEqual({ status: 'unreadable' });
  });
});
