import {
  ApiError,
  NetworkError,
  type AccountApi,
  type AccountUser,
  type Session,
} from './api';

export interface FakeAccountApi extends AccountApi {
  /** Si es true, todas las llamadas fallan como si el servidor estuviera apagado. */
  isDown: boolean;
  /** Correos con cuenta. */
  readonly emails: () => string[];
  /** Identificadores de sesión que el servidor da por válidos. */
  readonly activeTokens: () => string[];
  /** Cierra una sesión desde el servidor, como si hubiera caducado. */
  expire(token: string): void;
}

/**
 * API de cuentas en memoria, con las mismas respuestas que la real. Sirve
 * para los tests de la web, que no arrancan un servidor.
 */
export function createFakeAccountApi(): FakeAccountApi {
  const users = new Map<string, { user: AccountUser; password: string }>();
  const sessions = new Map<string, AccountUser>();
  let counter = 0;

  function startSession(user: AccountUser): Session {
    const token = `sesion-${++counter}-${'x'.repeat(30)}`;
    sessions.set(token, user);
    return { token, user };
  }

  function userOf(token: string): AccountUser {
    const user = sessions.get(token);
    if (!user) {
      throw new ApiError(401, 'Inicia sesión para continuar.');
    }
    return user;
  }

  const api: FakeAccountApi = {
    isDown: false,
    emails: () => [...users.keys()],
    activeTokens: () => [...sessions.keys()],
    expire: (token) => void sessions.delete(token),

    async register(email, password) {
      const normalized = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        throw new ApiError(400, 'Revisa los datos del formulario.', {
          email: 'Escribe un correo válido.',
        });
      }
      if (password.length < 8) {
        throw new ApiError(400, 'Revisa los datos del formulario.', {
          password: 'La contraseña debe tener al menos 8 caracteres.',
        });
      }
      if (users.has(normalized)) {
        throw new ApiError(409, 'Ya existe una cuenta con ese correo.', {
          email: 'Ya existe una cuenta con ese correo.',
        });
      }
      const user = { id: `usuario-${users.size + 1}`, email: normalized };
      users.set(normalized, { user, password });
      return startSession(user);
    },

    async login(email, password) {
      const account = users.get(email.trim().toLowerCase());
      if (!account || account.password !== password) {
        throw new ApiError(401, 'El correo o la contraseña no son correctos.');
      }
      return startSession(account.user);
    },

    async me(token) {
      return userOf(token);
    },

    async logout(token) {
      userOf(token);
      sessions.delete(token);
    },

    async deleteAccount(token) {
      const user = userOf(token);
      users.delete(user.email);
      for (const [key, owner] of sessions) {
        if (owner.id === user.id) {
          sessions.delete(key);
        }
      }
    },
  };

  // Con el servidor «apagado», cualquier llamada falla por la red.
  return new Proxy(api, {
    get(target, property, receiver) {
      const value: unknown = Reflect.get(target, property, receiver);
      const isCall = ['register', 'login', 'me', 'logout', 'deleteAccount'];
      if (typeof value === 'function' && isCall.includes(String(property))) {
        return async (...args: unknown[]) => {
          if (target.isDown) {
            throw new NetworkError();
          }
          return (value as (...args: unknown[]) => unknown).apply(target, args);
        };
      }
      return value;
    },
  });
}
