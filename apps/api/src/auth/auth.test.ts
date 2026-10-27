import { HttpException } from '@nestjs/common';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { corsOrigins, proxyHops } from '../app.setup.js';
import { parseCredentials } from './credentials.js';
import { hashPassword, verifyPassword } from './password.js';
import { RateLimiter } from './rate-limiter.js';
import {
  bearerToken,
  createSessionToken,
  hashSessionToken,
  SESSION_DAYS,
  sessionExpiry,
} from './tokens.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('contraseñas', () => {
  test('se cifran con scrypt y con los parámetros a la vista', async () => {
    const hash = await hashPassword('correcta-caballo');

    expect(hash).toMatch(
      /^scrypt\$32768\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/,
    );
    expect(hash).not.toContain('correcta-caballo');
  });

  test('cada contraseña lleva su propia sal', async () => {
    const [first, second] = await Promise.all([
      hashPassword('la misma contraseña'),
      hashPassword('la misma contraseña'),
    ]);

    expect(first).not.toBe(second);
    expect(first.split('$')[4]).not.toBe(second.split('$')[4]);
  });

  test('la contraseña correcta se verifica y las demás no', async () => {
    const hash = await hashPassword('correcta-caballo');

    expect(await verifyPassword('correcta-caballo', hash)).toBe(true);
    expect(await verifyPassword('correcta-caballO', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  test('admite contraseñas con cualquier carácter', async () => {
    const password = 'contraseña ñ 🔒 日本語';
    const hash = await hashPassword(password);

    expect(await verifyPassword(password, hash)).toBe(true);
  });

  test.each([
    '',
    'texto',
    'bcrypt$10$abc$def',
    'scrypt$32768$8$1$$',
    'scrypt$x$y$z$AAAA$AAAA',
  ])(
    'un valor guardado que no se entiende («%s») no verifica nada',
    async (stored) => {
      expect(await verifyPassword('cualquiera', stored)).toBe(false);
    },
  );
});

describe('identificadores de sesión', () => {
  test('son aleatorios, largos y distintos cada vez', () => {
    const tokens = Array.from({ length: 50 }, createSessionToken);

    expect(new Set(tokens).size).toBe(50);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });

  test('el resumen es SHA-256 y no deja ver el identificador', () => {
    const token = createSessionToken();
    const hash = hashSessionToken(token);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashSessionToken(token)).toBe(hash);
    expect(hashSessionToken(createSessionToken())).not.toBe(hash);
  });

  test(`una sesión caduca a los ${SESSION_DAYS} días`, () => {
    const now = new Date('2026-10-11T10:00:00.000Z');

    expect(sessionExpiry(now).toISOString()).toBe('2026-11-10T10:00:00.000Z');
  });

  test('bearerToken extrae el identificador de la cabecera', () => {
    const token = createSessionToken();

    expect(bearerToken(`Bearer ${token}`)).toBe(token);
  });

  test.each([
    undefined,
    '',
    'Bearer',
    'Bearer ',
    'Bearer corto',
    'Basic dXN1YXJpbzpjbGF2ZQ==',
    'bearer abcdefghijklmnopqrstuvwxyz',
    'Bearer abcdefghijklmnopqrstuvwxyz con espacios',
    ['Bearer abcdefghijklmnopqrstuvwxyz'],
  ])('bearerToken rechaza la cabecera %j', (header) => {
    expect(bearerToken(header)).toBeNull();
  });
});

describe('parseCredentials', () => {
  const register = { checkPasswordRules: true };
  const login = { checkPasswordRules: false };

  test('acepta un correo y una contraseña válidos', () => {
    expect(
      parseCredentials(
        { email: 'ana@example.com', password: '12345678' },
        register,
      ),
    ).toEqual({
      ok: true,
      credentials: { email: 'ana@example.com', password: '12345678' },
    });
  });

  test('guarda el correo sin espacios y en minúsculas', () => {
    const result = parseCredentials(
      { email: '  Ana.Pérez@Example.COM ', password: '12345678' },
      register,
    );

    expect(result).toMatchObject({
      credentials: { email: 'ana.pérez@example.com' },
    });
  });

  test('no toca la contraseña: ni espacios ni mayúsculas', () => {
    const result = parseCredentials(
      { email: 'ana@example.com', password: '  Con Espacios  ' },
      register,
    );

    expect(result).toMatchObject({
      credentials: { password: '  Con Espacios  ' },
    });
  });

  test.each([
    ['sin arroba', 'ana.example.com'],
    ['sin dominio', 'ana@'],
    ['sin punto en el dominio', 'ana@example'],
    ['con espacios', 'ana maria@example.com'],
    ['con dos arrobas', 'ana@@example.com'],
    ['demasiado largo', `${'a'.repeat(250)}@example.com`],
  ])('rechaza un correo %s', (_, email) => {
    expect(parseCredentials({ email, password: '12345678' }, register)).toEqual(
      {
        ok: false,
        errors: { email: 'Escribe un correo válido.' },
      },
    );
  });

  test('al registrarse exige al menos 8 caracteres de contraseña', () => {
    expect(
      parseCredentials(
        { email: 'ana@example.com', password: '1234567' },
        register,
      ),
    ).toEqual({
      ok: false,
      errors: { password: 'La contraseña debe tener al menos 8 caracteres.' },
    });
  });

  test('al iniciar sesión no aplica la longitud mínima', () => {
    expect(
      parseCredentials({ email: 'ana@example.com', password: '123' }, login).ok,
    ).toBe(true);
  });

  test('rechaza una contraseña desmesurada', () => {
    const result = parseCredentials(
      { email: 'ana@example.com', password: 'a'.repeat(201) },
      login,
    );

    expect(result).toMatchObject({ ok: false });
  });

  test.each([undefined, null, 'texto', 42, [], {}, { email: 5, password: {} }])(
    'con un cuerpo sin datos (%j) señala los dos campos',
    (body) => {
      expect(parseCredentials(body, register)).toEqual({
        ok: false,
        errors: {
          email: 'Escribe tu correo.',
          password: 'Escribe tu contraseña.',
        },
      });
    },
  );
});

describe('límite de intentos', () => {
  function limiter(max: number, minutes = 15) {
    vi.stubEnv('AUTH_RATE_LIMIT_MAX', String(max));
    vi.stubEnv('AUTH_RATE_LIMIT_WINDOW_MINUTES', String(minutes));
    return new RateLimiter();
  }

  test('por defecto admite 10 intentos cada 15 minutos', () => {
    const defaults = new RateLimiter();

    expect(defaults.maxAttempts).toBe(10);
    expect(defaults.windowMs).toBe(15 * 60 * 1000);
  });

  test('deja pasar hasta el máximo y rechaza el siguiente con un 429', () => {
    const rateLimiter = limiter(3);
    const start = 1_000_000;

    for (let attempt = 0; attempt < 3; attempt++) {
      expect(() => rateLimiter.consume('ip', start)).not.toThrow();
    }
    let error: unknown;
    try {
      rateLimiter.consume('ip', start + 60_000);
    } catch (reason) {
      error = reason;
    }

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    expect((error as HttpException).getResponse()).toEqual({
      message: 'Demasiados intentos. Vuelve a probar dentro de 14 minutos.',
      retryAfterSeconds: 14 * 60,
    });
  });

  test('cada clave lleva su propia cuenta', () => {
    const rateLimiter = limiter(1);

    rateLimiter.consume('una');

    expect(() => rateLimiter.consume('otra')).not.toThrow();
    expect(() => rateLimiter.consume('una')).toThrow(HttpException);
  });

  test('al pasar la ventana se vuelve a admitir', () => {
    const rateLimiter = limiter(1, 15);
    const start = 1_000_000;
    rateLimiter.consume('ip', start);
    expect(() => rateLimiter.consume('ip', start + 1)).toThrow(HttpException);

    expect(() =>
      rateLimiter.consume('ip', start + 15 * 60 * 1000),
    ).not.toThrow();
  });

  test('reset olvida los intentos de una clave', () => {
    const rateLimiter = limiter(1);
    rateLimiter.consume('ip');

    rateLimiter.reset('ip');

    expect(() => rateLimiter.consume('ip')).not.toThrow();
  });

  test.each(['', 'abc', '0', '-5'])(
    'con una configuración inválida («%s») usa el valor por defecto',
    (value) => {
      vi.stubEnv('AUTH_RATE_LIMIT_MAX', value);

      expect(new RateLimiter().maxAttempts).toBe(10);
    },
  );
});

describe('corsOrigins', () => {
  test('sin configurar no se admite ningún origen', () => {
    expect(corsOrigins(undefined)).toEqual([]);
    expect(corsOrigins('')).toEqual([]);
  });

  test('separa la lista por comas y limpia espacios y barras finales', () => {
    expect(
      corsOrigins(' http://localhost:5173 ,https://bingogoals.example/ ,, '),
    ).toEqual(['http://localhost:5173', 'https://bingogoals.example']);
  });
});

describe('proxyHops', () => {
  test.each([undefined, '', '0', '-1', '1.5', 'true', 'abc'])(
    'con «%s» no se confía en ningún proxy',
    (value) => {
      expect(proxyHops(value)).toBe(0);
    },
  );

  test('admite el número de saltos', () => {
    expect(proxyHops('1')).toBe(1);
    expect(proxyHops('2')).toBe(2);
  });
});
