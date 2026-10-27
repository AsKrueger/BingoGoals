// Tests de integración: necesitan un PostgreSQL real con las migraciones
// aplicadas. Se ejecutan con `npm run test:integration`.
import {
  createBoard,
  isBingoBoard,
  toggleCell,
  updateCell,
} from '@bingogoals/domain';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'vitest';
import { AppModule } from './app.module.js';
import { fromBoardRow, toBoardRow } from './boards/board.mapper.js';
import { PrismaService } from './prisma/prisma.service.js';

let app: INestApplication;
let prisma: PrismaService;
let url: string;

beforeAll(async () => {
  app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0);
  url = await app.getUrl();
  prisma = app.get(PrismaService);
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  // Borrar los usuarios borra también sus tableros, en cascada.
  await prisma.user.deleteMany();
});

function sampleBoard(size: '3x3' | '5x5' = '5x5') {
  let board = createBoard('Metas del año', size);
  board = updateCell(board, 0, {
    text: 'Correr 10 km',
    icon: '🏋️',
    color: '#2196F3',
    photoId: '0b7c8f3e-5a2d-4c1b-9e6f-1a2b3c4d5e6f',
  });
  return toggleCell(board, 0);
}

describe('GET /health', () => {
  test('con la base de datos disponible responde ok', async () => {
    const response = await fetch(`${url}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', database: 'ok' });
  });
});

describe('esquema', () => {
  test('las migraciones han creado las tablas de usuarios y tableros', async () => {
    const tables = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = current_schema() ORDER BY table_name`;

    expect(tables.map((table) => table.table_name)).toEqual(
      expect.arrayContaining(['boards', 'users']),
    );
  });

  test('un usuario recibe identificador y fechas', async () => {
    const user = await prisma.user.create({
      data: { email: 'ana@example.com', passwordHash: 'x' },
    });

    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  test('no admite dos usuarios con el mismo correo', async () => {
    await prisma.user.create({
      data: { email: 'ana@example.com', passwordHash: 'x' },
    });

    await expect(
      prisma.user.create({
        data: { email: 'ana@example.com', passwordHash: 'x' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  test('un tablero no puede existir sin su usuario', async () => {
    const row = toBoardRow(
      { board: sampleBoard(), archivedAt: null },
      '00000000-0000-4000-8000-000000000000',
    );

    await expect(prisma.board.create({ data: row })).rejects.toMatchObject({
      code: 'P2003',
    });
  });
});

describe('tableros', () => {
  test.each(['3x3', '5x5'] as const)(
    'un tablero %s se guarda y se recupera idéntico',
    async (size) => {
      const user = await prisma.user.create({
        data: { email: 'ana@example.com', passwordHash: 'x' },
      });
      const board = sampleBoard(size);

      await prisma.board.create({
        data: toBoardRow({ board, archivedAt: null }, user.id),
      });
      const row = await prisma.board.findUniqueOrThrow({
        where: { id: board.id },
      });

      const stored = fromBoardRow(row);
      expect(stored).toEqual({ board, archivedAt: null });
      expect(isBingoBoard(stored.board)).toBe(true);
    },
  );

  test('las casillas y el estilo van dentro del tablero, como JSON', async () => {
    const user = await prisma.user.create({
      data: { email: 'ana@example.com', passwordHash: 'x' },
    });
    const board = sampleBoard('3x3');
    await prisma.board.create({
      data: toBoardRow({ board, archivedAt: null }, user.id),
    });

    const [row] = await prisma.$queryRaw<
      { cells: number; theme: string; first: string; types: string }[]
    >`
      SELECT jsonb_array_length(cells) AS cells,
             style ->> 'theme' AS theme,
             cells -> 0 ->> 'text' AS first,
             pg_typeof(cells)::text || ',' || pg_typeof(style)::text AS types
      FROM boards WHERE id = ${board.id}::uuid`;

    expect(row).toEqual({
      cells: 9,
      theme: 'classic',
      first: 'Correr 10 km',
      types: 'jsonb,jsonb',
    });
  });

  test('conserva las fechas del cliente, sin sustituirlas', async () => {
    const user = await prisma.user.create({
      data: { email: 'ana@example.com', passwordHash: 'x' },
    });
    const board = toggleCell(
      createBoard('Metas', '3x3', new Date('2026-01-01T10:00:00.000Z')),
      0,
      new Date('2026-02-03T11:30:00.000Z'),
    );

    await prisma.board.create({
      data: toBoardRow({ board, archivedAt: null }, user.id),
    });
    // Un cambio posterior en la fila no debe tocar updatedAt por su cuenta.
    const row = await prisma.board.update({
      where: { id: board.id },
      data: { title: 'Otro título' },
    });

    expect(row.createdAt.toISOString()).toBe('2026-01-01T10:00:00.000Z');
    expect(row.updatedAt.toISOString()).toBe('2026-02-03T11:30:00.000Z');
  });

  test('un tablero archivado es el mismo registro con fecha de archivo', async () => {
    const user = await prisma.user.create({
      data: { email: 'ana@example.com', passwordHash: 'x' },
    });
    const board = sampleBoard();
    await prisma.board.create({
      data: toBoardRow({ board, archivedAt: null }, user.id),
    });

    await prisma.board.update({
      where: { id: board.id },
      data: { archivedAt: new Date('2026-10-05T09:00:00.000Z') },
    });

    const rows = await prisma.board.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(fromBoardRow(rows[0]!)).toEqual({
      board,
      archivedAt: '2026-10-05T09:00:00.000Z',
    });
    expect(
      await prisma.board.count({ where: { archivedAt: { not: null } } }),
    ).toBe(1);
  });

  test('cada usuario ve solo sus tableros', async () => {
    const ana = await prisma.user.create({
      data: { email: 'ana@example.com', passwordHash: 'x' },
    });
    const luis = await prisma.user.create({
      data: { email: 'luis@example.com', passwordHash: 'x' },
    });
    await prisma.board.create({
      data: toBoardRow({ board: sampleBoard(), archivedAt: null }, ana.id),
    });
    await prisma.board.create({
      data: toBoardRow({ board: sampleBoard(), archivedAt: null }, ana.id),
    });
    await prisma.board.create({
      data: toBoardRow({ board: sampleBoard(), archivedAt: null }, luis.id),
    });

    expect(await prisma.board.count({ where: { userId: ana.id } })).toBe(2);
    expect(await prisma.board.count({ where: { userId: luis.id } })).toBe(1);
  });

  test('al borrar un usuario se borran sus tableros', async () => {
    const user = await prisma.user.create({
      data: { email: 'ana@example.com', passwordHash: 'x' },
    });
    await prisma.board.create({
      data: toBoardRow({ board: sampleBoard(), archivedAt: null }, user.id),
    });

    await prisma.user.delete({ where: { id: user.id } });

    expect(await prisma.board.count()).toBe(0);
  });
});
