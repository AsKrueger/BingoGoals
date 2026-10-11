// Tests de integración de las rutas de autenticación, por HTTP y contra un
// PostgreSQL real. Se ejecutan con `npm run test:integration`.
import { createBoard } from '@bingogoals/domain';
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
import { toBoardRow } from '../boards/board.mapper.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RateLimiter } from './rate-limiter.js';
import { hashSessionToken } from './tokens.js';

const WEB_ORIGIN = 'http://localhost:5173';
const MAX_ATTEMPTS = 5;

let app: INestApplication;
let prisma: PrismaService;
let rateLimiter: RateLimiter;
let url: string;

beforeAll(async () => {
  process.env.CORS_ORIGINS = `${WEB_ORIGIN}, http://localhost:4173`;
  process.env.AUTH_RATE_LIMIT_MAX = String(MAX_ATTEMPTS);

  app = await createApp({ logger: false });
  await app.listen(0);
  url = await app.getUrl();
  prisma = app.get(PrismaService);
  rateLimiter = app.get(RateLimiter);
});

afterAll(async () => {
  await app.close();
  delete process.env.CORS_ORIGINS;
  delete process.env.AUTH_RATE_LIMIT_MAX;
});

beforeEach(async () => {
  await prisma.user.deleteMany();
  rateLimiter.resetAll();
});

interface Reply {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
  headers: Headers;
}

async function call(
  method: string,
  path: string,
  options: { body?: unknown; token?: string; origin?: string } = {},
): Promise<Reply> {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: {
      ...(options.body !== undefined && { 'Content-Type': 'application/json' }),
      ...(options.token && { Authorization: `Bearer ${options.token}` }),
      ...(options.origin && { Origin: options.origin }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text === '' ? null : JSON.parse(text),
    headers: response.headers,
  };
}

const ANA = { email: 'ana@example.com', password: 'correcta-caballo' };

async function register(credentials = ANA): Promise<string> {
  const reply = await call('POST', '/auth/register', { body: credentials });
  expect(reply.status).toBe(201);
  return reply.body.token as string;
}

describe('POST /auth/register', () => {
  test('crea la cuenta e inicia sesión', async () => {
    const reply = await call('POST', '/auth/register', { body: ANA });

    expect(reply.status).toBe(201);
    expect(reply.body).toEqual({
      token: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      user: { id: expect.stringMatching(/^[0-9a-f-]{36}$/), email: ANA.email },
    });
    expect(await prisma.user.count()).toBe(1);
  });

  test('guarda el correo en minúsculas y sin espacios', async () => {
    const reply = await call('POST', '/auth/register', {
      body: { email: '  Ana@Example.COM ', password: ANA.password },
    });

    expect(reply.body.user.email).toBe('ana@example.com');
    expect(await prisma.user.findFirst()).toMatchObject({
      email: 'ana@example.com',
    });
  });

  test('guarda la contraseña cifrada con scrypt, nunca la contraseña', async () => {
    await register();

    const user = await prisma.user.findFirstOrThrow();
    expect(user.passwordHash).toMatch(/^scrypt\$\d+\$\d+\$\d+\$.+\$.+$/);
    expect(JSON.stringify(user)).not.toContain(ANA.password);
  });

  test('guarda solo el resumen del identificador de sesión, con caducidad', async () => {
    const token = await register();

    const session = await prisma.session.findFirstOrThrow();
    expect(session.tokenHash).toBe(hashSessionToken(token));
    expect(JSON.stringify(session)).not.toContain(token);
    const days =
      (session.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30);
  });

  test('la respuesta no incluye la contraseña ni su valor cifrado', async () => {
    const reply = await call('POST', '/auth/register', { body: ANA });

    const text = JSON.stringify(reply.body);
    expect(text).not.toContain(ANA.password);
    expect(text).not.toMatch(/password|scrypt/i);
  });

  test('con un correo ya usado da un error claro y no crea nada', async () => {
    await register();

    const reply = await call('POST', '/auth/register', {
      body: { email: 'ANA@example.com', password: 'otra-contraseña' },
    });

    expect(reply.status).toBe(409);
    expect(reply.body).toMatchObject({
      message: 'Ya existe una cuenta con ese correo.',
      errors: { email: 'Ya existe una cuenta con ese correo.' },
    });
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.session.count()).toBe(1);
  });

  test.each([
    [{ email: 'no-es-un-correo', password: ANA.password }, 'email'],
    [{ email: ANA.email, password: 'corta' }, 'password'],
    [{ email: ANA.email }, 'password'],
    [{}, 'email'],
  ])(
    'con datos inválidos (%j) responde 400 e indica el campo',
    async (body, field) => {
      const reply = await call('POST', '/auth/register', { body });

      expect(reply.status).toBe(400);
      expect(reply.body.errors[field]).toEqual(expect.any(String));
      expect(await prisma.user.count()).toBe(0);
    },
  );
});

describe('POST /auth/login', () => {
  test('con el correo y la contraseña correctos inicia otra sesión', async () => {
    const first = await register();

    const reply = await call('POST', '/auth/login', { body: ANA });

    expect(reply.status).toBe(200);
    expect(reply.body.user.email).toBe(ANA.email);
    expect(reply.body.token).not.toBe(first);
    expect(await prisma.session.count()).toBe(2);
  });

  test('el correo no distingue mayúsculas', async () => {
    await register();

    const reply = await call('POST', '/auth/login', {
      body: { email: 'ANA@Example.com', password: ANA.password },
    });

    expect(reply.status).toBe(200);
  });

  test('un correo inexistente y una contraseña incorrecta dan la misma respuesta', async () => {
    await register();

    const wrongPassword = await call('POST', '/auth/login', {
      body: { email: ANA.email, password: 'incorrecta-incorrecta' },
    });
    const unknownEmail = await call('POST', '/auth/login', {
      body: { email: 'nadie@example.com', password: ANA.password },
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
    expect(wrongPassword.body.message).toBe(
      'El correo o la contraseña no son correctos.',
    );
    expect(await prisma.session.count()).toBe(1);
  });

  test('sin datos responde 400', async () => {
    const reply = await call('POST', '/auth/login', { body: {} });

    expect(reply.status).toBe(400);
    expect(reply.body.errors).toHaveProperty('email');
  });

  test('al iniciar sesión se limpian las sesiones caducadas del usuario', async () => {
    await register();
    const user = await prisma.user.findFirstOrThrow();
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: 'caducada',
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    await call('POST', '/auth/login', { body: ANA });

    expect(
      await prisma.session.count({ where: { tokenHash: 'caducada' } }),
    ).toBe(0);
    expect(await prisma.session.count()).toBe(2);
  });
});

describe('GET /auth/me', () => {
  test('con una sesión válida devuelve el usuario', async () => {
    const token = await register();

    const reply = await call('GET', '/auth/me', { token });

    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({
      user: { id: expect.any(String), email: ANA.email },
    });
  });

  test('no devuelve el identificador de sesión ni la contraseña', async () => {
    const token = await register();

    const text = JSON.stringify(
      (await call('GET', '/auth/me', { token })).body,
    );

    expect(text).not.toContain(token);
    expect(text).not.toMatch(/password|scrypt|token/i);
  });

  test.each([
    ['sin cabecera', undefined],
    ['con un identificador inventado', 'A'.repeat(43)],
    ['con un identificador mal formado', 'corto'],
  ])('%s responde 401', async (_, token) => {
    await register();

    const reply = await call('GET', '/auth/me', { token });

    expect(reply.status).toBe(401);
    expect(reply.body.message).toBe('Inicia sesión para continuar.');
  });

  test('con una sesión caducada responde 401', async () => {
    const token = await register();
    await prisma.session.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect((await call('GET', '/auth/me', { token })).status).toBe(401);
  });

  test('el resumen guardado no sirve como identificador', async () => {
    const token = await register();

    const reply = await call('GET', '/auth/me', {
      token: hashSessionToken(token),
    });

    expect(reply.status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  test('invalida la sesión en el servidor', async () => {
    const token = await register();

    const reply = await call('POST', '/auth/logout', { token });

    expect(reply.status).toBe(204);
    expect(reply.body).toBeNull();
    expect(await prisma.session.count()).toBe(0);
    expect((await call('GET', '/auth/me', { token })).status).toBe(401);
  });

  test('cierra solo esa sesión, no las demás del usuario', async () => {
    const first = await register();
    const second = (await call('POST', '/auth/login', { body: ANA })).body
      .token as string;

    await call('POST', '/auth/logout', { token: first });

    expect((await call('GET', '/auth/me', { token: first })).status).toBe(401);
    expect((await call('GET', '/auth/me', { token: second })).status).toBe(200);
  });

  test('sin sesión responde 401', async () => {
    expect((await call('POST', '/auth/logout')).status).toBe(401);
  });

  test('la cuenta sigue existiendo y se puede volver a entrar', async () => {
    const token = await register();
    await call('POST', '/auth/logout', { token });

    expect((await call('POST', '/auth/login', { body: ANA })).status).toBe(200);
  });
});

describe('DELETE /auth/account', () => {
  test('elimina el usuario, sus tableros y todas sus sesiones', async () => {
    const token = await register();
    await call('POST', '/auth/login', { body: ANA });
    const user = await prisma.user.findFirstOrThrow();
    await prisma.board.create({
      data: toBoardRow(
        { board: createBoard('Metas', '3x3'), archivedAt: null },
        user.id,
      ),
    });

    const reply = await call('DELETE', '/auth/account', { token });

    expect(reply.status).toBe(204);
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.board.count()).toBe(0);
    expect(await prisma.session.count()).toBe(0);
    expect((await call('GET', '/auth/me', { token })).status).toBe(401);
  });

  test('no toca las cuentas de los demás', async () => {
    const token = await register();
    const other = await register({
      email: 'luis@example.com',
      password: 'otra-contraseña',
    });

    await call('DELETE', '/auth/account', { token });

    expect(await prisma.user.count()).toBe(1);
    expect((await call('GET', '/auth/me', { token: other })).status).toBe(200);
  });

  test('sin sesión responde 401 y no borra nada', async () => {
    await register();

    expect((await call('DELETE', '/auth/account')).status).toBe(401);
    expect(await prisma.user.count()).toBe(1);
  });

  test('tras borrarla, el correo queda libre para registrarse de nuevo', async () => {
    const token = await register();
    await call('DELETE', '/auth/account', { token });

    expect((await call('POST', '/auth/register', { body: ANA })).status).toBe(
      201,
    );
  });
});

describe('límite de intentos', () => {
  test('el inicio de sesión se bloquea al superar el máximo', async () => {
    await register();
    rateLimiter.resetAll();
    const wrong = { email: ANA.email, password: 'incorrecta-incorrecta' };

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      expect((await call('POST', '/auth/login', { body: wrong })).status).toBe(
        401,
      );
    }
    const blocked = await call('POST', '/auth/login', { body: wrong });

    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toMatch(/^Demasiados intentos\./);
    expect(blocked.body.retryAfterSeconds).toBeGreaterThan(0);
    // Ni con la contraseña correcta se entra mientras dure el bloqueo.
    expect((await call('POST', '/auth/login', { body: ANA })).status).toBe(429);
  });

  test('un inicio de sesión correcto pone la cuenta a cero', async () => {
    await register();
    rateLimiter.resetAll();
    const wrong = { email: ANA.email, password: 'incorrecta-incorrecta' };

    for (let round = 0; round < 3; round++) {
      for (let attempt = 0; attempt < MAX_ATTEMPTS - 1; attempt++) {
        await call('POST', '/auth/login', { body: wrong });
      }
      expect((await call('POST', '/auth/login', { body: ANA })).status).toBe(
        200,
      );
    }
  });

  test('el registro se bloquea al superar el máximo', async () => {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      await call('POST', '/auth/register', {
        body: {
          email: `usuario${attempt}@example.com`,
          password: ANA.password,
        },
      });
    }

    const blocked = await call('POST', '/auth/register', {
      body: { email: 'uno-mas@example.com', password: ANA.password },
    });

    expect(blocked.status).toBe(429);
    expect(await prisma.user.count()).toBe(MAX_ATTEMPTS);
  });

  test('las rutas con sesión no tienen límite', async () => {
    const token = await register();

    for (let attempt = 0; attempt < MAX_ATTEMPTS * 3; attempt++) {
      expect((await call('GET', '/auth/me', { token })).status).toBe(200);
    }
  });
});

describe('CORS', () => {
  test('admite un origen configurado', async () => {
    const reply = await call('POST', '/auth/login', {
      body: {},
      origin: WEB_ORIGIN,
    });

    expect(reply.headers.get('access-control-allow-origin')).toBe(WEB_ORIGIN);
  });

  test('no admite un origen que no está configurado', async () => {
    const reply = await call('POST', '/auth/login', {
      body: {},
      origin: 'https://otro-sitio.example',
    });

    expect(reply.headers.get('access-control-allow-origin')).toBeNull();
  });

  test('la consulta previa permite la cabecera Authorization', async () => {
    const response = await fetch(`${url}/auth/me`, {
      method: 'OPTIONS',
      headers: {
        Origin: WEB_ORIGIN,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization',
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(
      WEB_ORIGIN,
    );
    expect(response.headers.get('access-control-allow-headers')).toMatch(
      /Authorization/i,
    );
    // Sin cookies: la sesión no viaja como credencial del navegador.
    expect(response.headers.get('access-control-allow-credentials')).toBeNull();
  });
});
