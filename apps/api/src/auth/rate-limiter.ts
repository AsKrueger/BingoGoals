import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

const DEFAULT_MAX_ATTEMPTS = 10;
const DEFAULT_WINDOW_MINUTES = 15;

interface Counter {
  attempts: number;
  resetAt: number;
}

function positiveNumber(value: string | undefined, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

/**
 * Límite de intentos de registro y de inicio de sesión, para frenar a quien
 * prueba contraseñas. Cuenta los intentos por clave (una dirección IP o un
 * correo) dentro de una ventana de tiempo.
 *
 * Los contadores viven en la memoria de este proceso: sirve mientras la API
 * sea una sola instancia.
 */
@Injectable()
export class RateLimiter {
  private readonly counters = new Map<string, Counter>();
  readonly maxAttempts = positiveNumber(
    process.env.AUTH_RATE_LIMIT_MAX,
    DEFAULT_MAX_ATTEMPTS,
  );
  readonly windowMs =
    positiveNumber(
      process.env.AUTH_RATE_LIMIT_WINDOW_MINUTES,
      DEFAULT_WINDOW_MINUTES,
    ) *
    60 *
    1000;

  /** Anota un intento. Lanza un 429 si la clave ha agotado los suyos. */
  consume(key: string, now: number = Date.now()): void {
    this.forgetExpired(now);

    const counter = this.counters.get(key) ?? {
      attempts: 0,
      resetAt: now + this.windowMs,
    };
    counter.attempts++;
    this.counters.set(key, counter);

    if (counter.attempts > this.maxAttempts) {
      const minutes = Math.ceil((counter.resetAt - now) / 60_000);
      throw new HttpException(
        {
          message: `Demasiados intentos. Vuelve a probar dentro de ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}.`,
          retryAfterSeconds: Math.ceil((counter.resetAt - now) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** Olvida los intentos de una clave, por ejemplo tras iniciar sesión bien. */
  reset(key: string): void {
    this.counters.delete(key);
  }

  /** Olvida todos los intentos. */
  resetAll(): void {
    this.counters.clear();
  }

  private forgetExpired(now: number) {
    for (const [key, counter] of this.counters) {
      if (counter.resetAt <= now) {
        this.counters.delete(key);
      }
    }
  }
}
