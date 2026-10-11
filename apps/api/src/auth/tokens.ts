import { createHash, randomBytes } from 'node:crypto';

/** Días que dura una sesión desde que se inicia. */
export const SESSION_DAYS = 30;

/**
 * Identificador de sesión: 256 bits aleatorios, sin ningún significado. Solo
 * lo conoce el cliente; el servidor guarda su resumen.
 */
export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Resumen SHA-256 del identificador, que es lo que se guarda y se busca. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function sessionExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

/** Extrae el identificador de una cabecera `Authorization: Bearer <id>`. */
export function bearerToken(header: unknown): string | null {
  if (typeof header !== 'string') {
    return null;
  }
  const match = /^Bearer ([A-Za-z0-9_-]{20,200})$/.exec(header);
  return match?.[1] ?? null;
}
