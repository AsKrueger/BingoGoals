import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// Las contraseñas se cifran con scrypt, del módulo crypto de Node, y una sal
// distinta para cada una. El resultado guarda también los parámetros, para
// poder endurecerlos más adelante sin invalidar las contraseñas ya guardadas:
//
//   scrypt$<N>$<r>$<p>$<sal en base64>$<clave en base64>

const COST = 2 ** 15;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const SALT_BYTES = 16;
const KEY_BYTES = 64;
/** Con estos parámetros scrypt usa unos 32 MB; el límite por defecto no llega. */
const MAX_MEMORY = 128 * 1024 * 1024;

function derive(
  password: string,
  salt: Buffer,
  cost: number,
  blockSize: number,
  parallelization: number,
  keyBytes: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize('NFKC'),
      salt,
      keyBytes,
      { N: cost, r: blockSize, p: parallelization, maxmem: MAX_MEMORY },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(
    password,
    salt,
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
    KEY_BYTES,
  );
  return [
    'scrypt',
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$');
}

/** false si la contraseña no coincide o si el valor guardado no se entiende. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, cost, blockSize, parallelization, salt, key] =
    stored.split('$');
  if (scheme !== 'scrypt' || !salt || !key) {
    return false;
  }

  const expected = Buffer.from(key, 'base64');
  try {
    const actual = await derive(
      password,
      Buffer.from(salt, 'base64'),
      Number(cost),
      Number(blockSize),
      Number(parallelization),
      expected.length,
    );
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * Valor cifrado de una contraseña que nadie conoce. Se verifica contra él
 * cuando el correo no existe, para que ese caso tarde lo mismo que una
 * contraseña incorrecta y no delate qué correos están registrados.
 */
export const UNKNOWN_PASSWORD_HASH = hashPassword(
  randomBytes(32).toString('base64'),
);
