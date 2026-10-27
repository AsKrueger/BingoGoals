// Test de integración: cabeceras de seguridad y dirección IP detrás de un
// proxy, por HTTP. No necesita PostgreSQL: el registro rechaza el cuerpo
// vacío antes de llegar a la base de datos.
import type { INestApplication } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createApp, SECURITY_HEADERS } from './app.setup.js';

const MAX_ATTEMPTS = 3;

let app: INestApplication | undefined;
let originalUrl: string | undefined;

beforeEach(() => {
  originalUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL =
    'postgresql://nadie:nadie@127.0.0.1:1/ninguna?schema=public';
  process.env.AUTH_RATE_LIMIT_MAX = String(MAX_ATTEMPTS);
});

afterEach(async () => {
  await app?.close();
  app = undefined;
  process.env.DATABASE_URL = originalUrl;
  delete process.env.AUTH_RATE_LIMIT_MAX;
  delete process.env.TRUST_PROXY;
});

async function start(trustProxy?: string): Promise<string> {
  if (trustProxy !== undefined) {
    process.env.TRUST_PROXY = trustProxy;
  }
  app = await createApp({ logger: false });
  await app.listen(0);
  return app.getUrl();
}

/** Un intento de registro con la cabecera que escribiría el proxy. */
async function register(url: string, forwardedFor?: string) {
  const response = await fetch(`${url}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(forwardedFor ? { 'X-Forwarded-For': forwardedFor } : {}),
    },
    body: '{}',
  });
  return response.status;
}

async function attempts(url: string, forwardedFor: (index: number) => string) {
  const statuses: number[] = [];
  for (let index = 0; index <= MAX_ATTEMPTS; index++) {
    statuses.push(await register(url, forwardedFor(index)));
  }
  return statuses;
}

const LIMITED = [...Array<number>(MAX_ATTEMPTS).fill(400), 429];

describe('cabeceras de seguridad', () => {
  test('van en todas las respuestas, también en los errores', async () => {
    const url = await start();

    const response = await fetch(`${url}/health`);

    expect(response.status).toBe(503);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(response.headers.get(name)).toBe(value);
    }
    expect(response.headers.get('X-Powered-By')).toBeNull();
  });
});

describe('dirección IP detrás del proxy', () => {
  test('sin TRUST_PROXY se ignora X-Forwarded-For', async () => {
    const url = await start();

    // Cambiar la cabecera en cada intento no salta el límite.
    expect(await attempts(url, (index) => `198.51.100.${index}`)).toEqual(
      LIMITED,
    );
  });

  test('con un salto, cuenta la dirección que añade el proxy', async () => {
    const url = await start('1');

    // El cliente inventa la primera dirección; el proxy añade la real.
    expect(
      await attempts(url, (index) => `198.51.100.${index}, 203.0.113.5`),
    ).toEqual(LIMITED);
    // Otro cliente, detrás del mismo proxy, tiene sus propios intentos.
    expect(await register(url, '203.0.113.6')).toBe(400);
  });
});
