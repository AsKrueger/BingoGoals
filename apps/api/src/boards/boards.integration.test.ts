// Tests de integración de la API de tableros, por HTTP y contra un PostgreSQL
// real. Se ejecutan con `npm run test:integration`.
import {
  createBoard,
  renameBoard,
  toggleCell,
  type BingoBoard,
} from '@bingogoals/domain';
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

interface Reply {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
}

async function call(
  method: string,
  path: string,
  token: string | null,
  body?: unknown,
): Promise<Reply> {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text === '' ? null : JSON.parse(text),
  };
}

async function account(email: string): Promise<string> {
  const reply = await call('POST', '/auth/register', null, {
    email,
    password: 'correcta-caballo',
  });
  return reply.body.token as string;
}

const at = (iso: string) => new Date(iso);
const T1 = at('2026-10-20T10:00:00.000Z');
const T2 = at('2026-10-20T11:00:00.000Z');
const T3 = at('2026-10-20T12:00:00.000Z');

function put(
  token: string,
  board: BingoBoard,
  archivedAt: string | null = null,
) {
  return call('PUT', `/boards/${board.id}`, token, { board, archivedAt });
}

function remove(token: string, id: string, deletedAt: Date) {
  return call(
    'DELETE',
    `/boards/${id}?deletedAt=${encodeURIComponent(deletedAt.toISOString())}`,
    token,
  );
}

async function list(token: string, since?: string) {
  const query = since ? `?since=${encodeURIComponent(since)}` : '';
  return call('GET', `/boards${query}`, token);
}

describe('protección', () => {
  test.each([
    ['GET', '/boards'],
    ['PUT', `/boards/${createBoard('Metas', '3x3').id}`],
    [
      'DELETE',
      `/boards/${createBoard('Metas', '3x3').id}?deletedAt=2026-10-20T10:00:00.000Z`,
    ],
  ])('%s %s sin sesión responde 401', async (method, path) => {
    expect((await call(method, path, null)).status).toBe(401);
  });
});

describe('PUT /boards/:id', () => {
  test('guarda un tablero nuevo y GET lo devuelve idéntico', async () => {
    const token = await account('ana@example.com');
    const board = toggleCell(createBoard('Metas', '5x5', T1), 0, T2);

    expect((await put(token, board)).status).toBe(204);

    const reply = await list(token);
    expect(reply.status).toBe(200);
    expect(reply.body.boards).toEqual([
      { board, archivedAt: null, deletedAt: null },
    ]);
  });

  test('guarda la fecha de archivo', async () => {
    const token = await account('ana@example.com');
    const board = createBoard('Metas', '3x3', T1);

    await put(token, board, '2026-10-21T09:00:00.000Z');

    expect((await list(token)).body.boards[0].archivedAt).toBe(
      '2026-10-21T09:00:00.000Z',
    );
  });

  test('una versión más reciente sustituye a la guardada', async () => {
    const token = await account('ana@example.com');
    const board = createBoard('Metas', '3x3', T1);
    await put(token, board);

    const newer = renameBoard(board, 'Metas nuevas', T2);
    expect((await put(token, newer)).status).toBe(204);

    expect((await list(token)).body.boards[0].board.title).toBe('Metas nuevas');
  });

  test('una versión más antigua se rechaza con 409 y la versión guardada', async () => {
    const token = await account('ana@example.com');
    const board = createBoard('Metas', '3x3', T1);
    const newer = renameBoard(board, 'Nueva', T3);
    await put(token, newer);

    const reply = await put(token, renameBoard(board, 'Antigua', T2));

    expect(reply.status).toBe(409);
    expect(reply.body.current).toEqual({
      board: newer,
      archivedAt: null,
      deletedAt: null,
    });
    expect((await list(token)).body.boards[0].board.title).toBe('Nueva');
  });

  test('enviar dos veces la misma versión no es un conflicto', async () => {
    const token = await account('ana@example.com');
    const board = createBoard('Metas', '3x3', T1);

    await put(token, board);

    expect((await put(token, board)).status).toBe(204);
  });

  test('misma fecha y distinto contenido es un conflicto: gana la guardada', async () => {
    const token = await account('ana@example.com');
    const board = createBoard('Metas', '3x3', T1);
    const first = renameBoard(board, 'Primero', T2);
    await put(token, first);

    const reply = await put(token, renameBoard(board, 'Segundo', T2));

    expect(reply.status).toBe(409);
    expect(reply.body.current.board.title).toBe('Primero');
  });

  test.each<[string, (board: BingoBoard) => unknown]>([
    ['un tablero corrupto', (board) => ({ board: { ...board, cells: [] } })],
    ['sin tablero', () => ({})],
    ['un título vacío', (board) => ({ board: { ...board, title: '' } })],
    [
      'un título demasiado largo',
      (board) => ({ board: { ...board, title: 'x'.repeat(41) } }),
    ],
    [
      'una fecha de archivo inválida',
      (board) => ({ board, archivedAt: 'ayer' }),
    ],
    [
      'una fecha muy adelantada',
      (board) => ({
        board: {
          ...board,
          updatedAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        },
      }),
    ],
    [
      'un identificador distinto del de la dirección',
      (board) => ({ board: { ...board, id: createBoard('Otro', '3x3').id } }),
    ],
  ])('rechaza con 400 %s', async (_, body) => {
    const token = await account('ana@example.com');
    const board = createBoard('Metas', '3x3', T1);

    const reply = await call('PUT', `/boards/${board.id}`, token, body(board));

    expect(reply.status).toBe(400);
    expect(reply.body.message).toEqual(expect.any(String));
    expect(await prisma.board.count()).toBe(0);
  });

  test('admite una fecha un poco adelantada, dentro del margen', async () => {
    const token = await account('ana@example.com');
    const board = createBoard('Metas', '3x3', new Date(Date.now() + 60 * 1000));

    expect((await put(token, board)).status).toBe(204);
  });

  test('un identificador que no es un UUID responde 400', async () => {
    const token = await account('ana@example.com');

    const reply = await call('PUT', '/boards/no-es-un-uuid', token, {});

    expect(reply.status).toBe(400);
  });
});

describe('DELETE /boards/:id', () => {
  test('borra de forma lógica: GET lo devuelve con su fecha de borrado', async () => {
    const token = await account('ana@example.com');
    const board = createBoard('Metas', '3x3', T1);
    await put(token, board);

    expect((await remove(token, board.id, T2)).status).toBe(204);

    const [record] = (await list(token)).body.boards;
    expect(record.deletedAt).toBe(T2.toISOString());
    expect(record.board.updatedAt).toBe(T2.toISOString());
    expect(await prisma.board.count()).toBe(1);
  });

  test('un cambio posterior al borrado gana: responde 409 con el cambio', async () => {
    const token = await account('ana@example.com');
    const board = renameBoard(createBoard('Metas', '3x3', T1), 'Tarde', T3);
    await put(token, board);

    const reply = await remove(token, board.id, T2);

    expect(reply.status).toBe(409);
    expect(reply.body.current.board.title).toBe('Tarde');
    expect(reply.body.current.deletedAt).toBeNull();
  });

  test('un cambio posterior a un borrado devuelve el tablero', async () => {
    const token = await account('ana@example.com');
    const board = createBoard('Metas', '3x3', T1);
    await put(token, board);
    await remove(token, board.id, T2);

    expect((await put(token, renameBoard(board, 'Vuelve', T3))).status).toBe(
      204,
    );

    const [record] = (await list(token)).body.boards;
    expect(record.deletedAt).toBeNull();
    expect(record.board.title).toBe('Vuelve');
  });

  test('un cambio anterior a un borrado no lo deshace', async () => {
    const token = await account('ana@example.com');
    const board = createBoard('Metas', '3x3', T1);
    await put(token, board);
    await remove(token, board.id, T3);

    const reply = await put(token, renameBoard(board, 'Tarde', T2));

    expect(reply.status).toBe(409);
    expect(reply.body.current.deletedAt).toBe(T3.toISOString());
  });

  test('borrar algo que no existe o ya está borrado no es un error', async () => {
    const token = await account('ana@example.com');
    const board = createBoard('Metas', '3x3', T1);

    expect((await remove(token, board.id, T2)).status).toBe(204);
    await put(token, board);
    await remove(token, board.id, T2);
    expect((await remove(token, board.id, T3)).status).toBe(204);
  });

  test.each([
    '',
    'deletedAt=ayer',
    `deletedAt=${new Date(Date.now() + 3600_000).toISOString()}`,
  ])('sin una fecha de borrado válida («%s») responde 400', async (query) => {
    const token = await account('ana@example.com');
    const board = createBoard('Metas', '3x3', T1);

    const reply = await call('DELETE', `/boards/${board.id}?${query}`, token);

    expect(reply.status).toBe(400);
  });
});

describe('GET /boards', () => {
  test('sin tableros devuelve una lista vacía y un cursor', async () => {
    const token = await account('ana@example.com');

    const reply = await list(token);

    expect(reply.body).toEqual({ boards: [], cursor: expect.any(String) });
    expect(Date.parse(reply.body.cursor)).not.toBeNaN();
  });

  test('con since devuelve solo lo cambiado desde entonces', async () => {
    const token = await account('ana@example.com');
    const first = createBoard('Primero', '3x3', T1);
    const second = createBoard('Segundo', '3x3', T1);
    await put(token, first);
    // Se fija la hora de servidor del primero en el pasado.
    await prisma.board.update({
      where: { id: first.id },
      data: { syncedAt: at('2026-01-01T00:00:00.000Z') },
    });
    await put(token, second);

    const reply = await list(token, '2026-06-01T00:00:00.000Z');

    expect(
      reply.body.boards.map(
        (record: { board: BingoBoard }) => record.board.title,
      ),
    ).toEqual(['Segundo']);
  });

  test('el cursor devuelto recoge los cambios hechos después', async () => {
    const token = await account('ana@example.com');
    await put(token, createBoard('Antes', '3x3', T1));
    const { cursor } = (await list(token)).body;

    await put(token, createBoard('Después', '3x3', T1));

    const titles = (await list(token, cursor)).body.boards.map(
      (record: { board: BingoBoard }) => record.board.title,
    );
    expect(titles).toContain('Después');
  });

  test('un since inválido responde 400', async () => {
    const token = await account('ana@example.com');

    expect((await list(token, 'ayer')).status).toBe(400);
  });
});

describe('cada usuario, sus tableros', () => {
  test('nadie ve los tableros de otro', async () => {
    const ana = await account('ana@example.com');
    const luis = await account('luis@example.com');
    await put(ana, createBoard('De Ana', '3x3', T1));

    expect((await list(luis)).body.boards).toEqual([]);
  });

  test('nadie puede cambiar ni borrar el tablero de otro', async () => {
    const ana = await account('ana@example.com');
    const luis = await account('luis@example.com');
    const board = createBoard('De Ana', '3x3', T1);
    await put(ana, board);

    const change = await put(luis, renameBoard(board, 'De Luis', T3));
    const deletion = await remove(luis, board.id, T3);

    expect(change.status).toBe(404);
    expect(deletion.status).toBe(404);
    const [record] = (await list(ana)).body.boards;
    expect(record.board.title).toBe('De Ana');
    expect(record.deletedAt).toBeNull();
  });
});
