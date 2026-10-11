// Test de integración: comprueba la API sin base de datos. No necesita
// PostgreSQL; apunta a un puerto en el que no escucha nadie.
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { AppModule } from './app.module.js';

let app: INestApplication;
let url: string;
let originalUrl: string | undefined;

beforeAll(async () => {
  originalUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL =
    'postgresql://nadie:nadie@127.0.0.1:1/ninguna?schema=public';

  app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0);
  url = await app.getUrl();
});

afterAll(async () => {
  await app.close();
  process.env.DATABASE_URL = originalUrl;
});

describe('GET /health sin base de datos', () => {
  test('la API arranca aunque la base de datos no esté disponible', () => {
    expect(url).toMatch(/^http:/);
  });

  test('responde 503 con el detalle, sin colgarse', async () => {
    const start = Date.now();

    const response = await fetch(`${url}/health`);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'error',
      database: 'unavailable',
    });
    expect(Date.now() - start).toBeLessThan(5000);
  });

  test('sigue respondiendo en peticiones sucesivas', async () => {
    const responses = await Promise.all([
      fetch(`${url}/health`),
      fetch(`${url}/health`),
      fetch(`${url}/health`),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      503, 503, 503,
    ]);
  });
});
