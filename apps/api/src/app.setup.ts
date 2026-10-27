import { MAX_PHOTO_BYTES, PHOTO_TYPES } from '@bingogoals/domain';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { IncomingMessage, ServerResponse } from 'node:http';
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

/**
 * Proxies de confianza delante de la API, a partir de `TRUST_PROXY`: cuántos
 * saltos de `X-Forwarded-For` añade el proveedor. Sin la variable no se confía
 * en ninguno y la IP es la de la conexión. Nunca se confía en todos: la
 * primera dirección de la cabecera la puede escribir cualquiera.
 */
export function proxyHops(value: string | undefined): number {
  const hops = Number(value);
  return Number.isInteger(hops) && hops > 0 ? hops : 0;
}

/**
 * Cabeceras de seguridad. La API solo responde JSON y fotos: nada de lo que
 * devuelve debe ejecutarse, mostrarse dentro de otra página ni adivinar su
 * tipo.
 */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
};

function securityHeaders(
  _request: IncomingMessage,
  response: ServerResponse,
  next: () => void,
) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.setHeader(name, value);
  }
  next();
}

/** Crea la API tal como se ejecuta, lista para escuchar. */
export async function createApp(
  options: { logger?: false } = {},
): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    options,
  );

  // Detrás del proxy del proveedor, la IP del cliente llega en
  // X-Forwarded-For. El límite de intentos la necesita.
  app.set('trust proxy', proxyHops(process.env.TRUST_PROXY));
  app.disable('x-powered-by');
  app.use(securityHeaders);

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
