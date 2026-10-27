import { MAX_PHOTO_BYTES, PHOTO_TYPES } from '@bingogoals/domain';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';

/**
 * Orígenes desde los que un navegador puede llamar a la API, a partir de
 * `CORS_ORIGINS`: una lista separada por comas. Sin la variable no se admite
 * ninguno.
 */
export function corsOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter((origin) => origin !== '');
}

/** Crea la API tal como se ejecuta, lista para escuchar. */
export async function createApp(
  options: { logger?: false } = {},
): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    options,
  );

  // Las fotos llegan tal cual, sin JSON. El resto de peticiones siguen con el
  // límite por defecto de 100 KB.
  app.useBodyParser('raw', { type: [...PHOTO_TYPES], limit: MAX_PHOTO_BYTES });

  app.enableCors({
    origin: corsOrigins(process.env.CORS_ORIGINS),
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // La sesión viaja en la cabecera Authorization, no en cookies.
    credentials: false,
    maxAge: 600,
  });

  return app;
}
