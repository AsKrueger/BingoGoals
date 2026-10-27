// Tests de integración de la API de fotos, por HTTP y contra un PostgreSQL
// real. Se ejecutan con `npm run test:integration`.
import { createBoard, updateCell, type BingoBoard } from '@bingogoals/domain';
import type { INestApplication } from '@nestjs/common';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'vitest';
import { createApp } from '../app.setup.js';
import { RateLimiter } from '../auth/rate-limiter.js';
import { PrismaService } from '../prisma/prisma.service.js';

let app: INestApplication;
let prisma: PrismaService;
let url: string;

beforeAll(async () => {
  app = await createApp({ logger: false });
  await app.listen(0);
  url = await app.getUrl();
  prisma = app.get(PrismaService);
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await prisma.user.deleteMany();
  app.get(RateLimiter).resetAll();
});

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9]);
const T1 = new Date('2026-10-20T10:00:00.000Z');
const T2 = new Date('2026-10-20T11:00:00.000Z');
const T3 = new Date('2026-10-20T12:00:00.000Z');

async function account(email: string): Promise<string> {
  const response = await fetch(`${url}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'correcta-caballo' }),
  });
  return ((await response.json()) as { token: string }).token;
}

function auth(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function upload(
  token: string | null,
  id: string,
  bytes: Uint8Array,
  type = 'image/jpeg',
) {
  return fetch(`${url}/photos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': type, ...auth(token) },
    body: bytes,
  });
}

function download(token: string | null, id: string) {
  return fetch(`${url}/photos/${id}`, { headers: auth(token) });
}

async function putBoard(token: string, board: BingoBoard) {
  const response = await fetch(`${url}/boards/${board.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...auth(token) },
    body: JSON.stringify({ board, archivedAt: null }),
  });
  return {
    status: response.status,
    body: (await response.json()) as { missingPhotos: string[] },
  };
}

function removeBoard(token: string, id: string, deletedAt: Date) {
  const query = encodeURIComponent(deletedAt.toISOString());
  return fetch(`${url}/boards/${id}?deletedAt=${query}`, {
    method: 'DELETE',
    headers: auth(token),
  });
}

/** Tablero con la foto `photoId` en la primera casilla. */
function boardWith(
  photoId: string | null,
  board = createBoard('Metas', '3x3', T1),
  when = T1,
) {
  return updateCell(board, 0, { photoId }, when);
}

async function stored(id: string) {
  return (await prisma.photo.count({ where: { id } })) === 1;
}

describe('protección', () => {
  test('PUT /photos/:id sin sesión responde 401', async () => {
    expect((await upload(null, crypto.randomUUID(), JPEG)).status).toBe(401);
  });

  test('GET /photos/:id sin sesión responde 401', async () => {
    expect((await download(null, crypto.randomUUID())).status).toBe(401);
  });

  test('un usuario no puede leer las fotos de otro', async () => {
    const ana = await account('ana@example.com');
    const luis = await account('luis@example.com');
    const id = crypto.randomUUID();
    await upload(ana, id, JPEG);

    expect((await download(luis, id)).status).toBe(404);
  });

  test('ni sustituirlas subiendo otra con el mismo identificador', async () => {
    const ana = await account('ana@example.com');
    const luis = await account('luis@example.com');
    const id = crypto.randomUUID();
    await upload(ana, id, JPEG);

    expect((await upload(luis, id, PNG, 'image/png')).status).toBe(409);

    const response = await download(ana, id);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(JPEG);
  });
});

describe('PUT y GET /photos/:id', () => {
  test('guarda la foto y la devuelve idéntica, con su tipo', async () => {
    const token = await account('ana@example.com');
    const id = crypto.randomUUID();

    expect((await upload(token, id, PNG, 'image/png')).status).toBe(204);

    const response = await download(token, id);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('cache-control')).toContain('immutable');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG);
  });

  test('el tipo sale del contenido, no de la cabecera', async () => {
    const token = await account('ana@example.com');
    const id = crypto.randomUUID();

    await upload(token, id, PNG, 'image/jpeg');

    expect((await download(token, id)).headers.get('content-type')).toBe(
      'image/png',
    );
  });

  test('subir dos veces la misma foto no es un error y no la cambia', async () => {
    const token = await account('ana@example.com');
    const id = crypto.randomUUID();
    await upload(token, id, JPEG);

    expect((await upload(token, id, PNG, 'image/png')).status).toBe(204);

    const response = await download(token, id);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(JPEG);
  });

  test.each([
    [
      'un archivo que no es una imagen',
      new TextEncoder().encode('<svg/>'),
      'image/png',
    ],
    ['un archivo vacío', new Uint8Array(), 'image/jpeg'],
    ['un tipo no admitido', JPEG, 'image/gif'],
    ['JSON', new TextEncoder().encode('{"foto":1}'), 'application/json'],
  ])('rechaza %s con 400', async (_, bytes, type) => {
    const token = await account('ana@example.com');

    const response = await upload(token, crypto.randomUUID(), bytes, type);

    expect(response.status).toBe(400);
  });

  test('rechaza una foto de más de 2 MB con 413', async () => {
    const token = await account('ana@example.com');
    const big = new Uint8Array(2 * 1024 * 1024 + 1);
    big.set(JPEG);

    expect((await upload(token, crypto.randomUUID(), big)).status).toBe(413);
  });

  test('un identificador que no es un UUID responde 400', async () => {
    const token = await account('ana@example.com');

    expect((await upload(token, 'foto.jpg', JPEG)).status).toBe(400);
  });

  test('una foto que no existe responde 404', async () => {
    const token = await account('ana@example.com');

    expect((await download(token, crypto.randomUUID())).status).toBe(404);
  });
});

describe('fotos de los tableros', () => {
  test('al guardar un tablero, la API dice qué fotos le faltan', async () => {
    const token = await account('ana@example.com');
    const id = crypto.randomUUID();

    const first = await putBoard(token, boardWith(id));
    expect(first.status).toBe(200);
    expect(first.body.missingPhotos).toEqual([id]);

    await upload(token, id, JPEG);
    const second = await putBoard(token, boardWith(id));
    expect(second.body.missingPhotos).toEqual([]);
  });

  test('una foto de otro usuario cuenta como que falta', async () => {
    const ana = await account('ana@example.com');
    const luis = await account('luis@example.com');
    const id = crypto.randomUUID();
    await upload(ana, id, JPEG);

    expect((await putBoard(luis, boardWith(id))).body.missingPhotos).toEqual([
      id,
    ]);
  });

  test('cambiar la foto de una casilla borra la anterior', async () => {
    const token = await account('ana@example.com');
    const [first, second] = [crypto.randomUUID(), crypto.randomUUID()];
    await upload(token, first, JPEG);
    const board = boardWith(first);
    await putBoard(token, board);
    await upload(token, second, JPEG);

    await putBoard(token, boardWith(second, board, T2));

    expect(await stored(first)).toBe(false);
    expect(await stored(second)).toBe(true);
  });

  test('quitar la foto de una casilla la borra', async () => {
    const token = await account('ana@example.com');
    const id = crypto.randomUUID();
    await upload(token, id, JPEG);
    const board = boardWith(id);
    await putBoard(token, board);

    await putBoard(token, boardWith(null, board, T2));

    expect(await stored(id)).toBe(false);
  });

  test('una foto que sigue en otra casilla no se borra', async () => {
    const token = await account('ana@example.com');
    const id = crypto.randomUUID();
    await upload(token, id, JPEG);
    const board = updateCell(boardWith(id), 1, { photoId: id }, T1);
    await putBoard(token, board);

    await putBoard(token, boardWith(null, board, T2));

    expect(await stored(id)).toBe(true);
  });

  test('una foto que usa otro tablero no se borra', async () => {
    const token = await account('ana@example.com');
    const id = crypto.randomUUID();
    await upload(token, id, JPEG);
    const board = boardWith(id);
    await putBoard(token, board);
    await putBoard(token, boardWith(id, createBoard('Otro', '3x3', T1)));

    await putBoard(token, boardWith(null, board, T2));

    expect(await stored(id)).toBe(true);
  });

  test('borrar un tablero borra sus fotos', async () => {
    const token = await account('ana@example.com');
    const id = crypto.randomUUID();
    await upload(token, id, JPEG);
    const board = boardWith(id);
    await putBoard(token, board);

    expect((await removeBoard(token, board.id, T3)).status).toBe(204);

    expect(await stored(id)).toBe(false);
  });

  test('una foto recién subida que aún no usa ningún tablero se conserva', async () => {
    const token = await account('ana@example.com');
    const id = crypto.randomUUID();
    await upload(token, id, JPEG);

    await putBoard(token, boardWith(null));

    expect(await stored(id)).toBe(true);
  });

  test('una foto sin usar desde hace más de un día se borra', async () => {
    const token = await account('ana@example.com');
    const id = crypto.randomUUID();
    await upload(token, id, JPEG);
    await prisma.photo.update({
      where: { id },
      data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });

    await putBoard(token, boardWith(null));

    expect(await stored(id)).toBe(false);
  });

  test('borrar la cuenta borra sus fotos', async () => {
    const token = await account('ana@example.com');
    const id = crypto.randomUUID();
    await upload(token, id, JPEG);

    await fetch(`${url}/auth/account`, {
      method: 'DELETE',
      headers: auth(token),
    });

    expect(await stored(id)).toBe(false);
  });
});
