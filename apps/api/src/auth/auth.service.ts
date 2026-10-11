import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Credentials } from './credentials.js';
import {
  hashPassword,
  UNKNOWN_PASSWORD_HASH,
  verifyPassword,
} from './password.js';
import {
  createSessionToken,
  hashSessionToken,
  sessionExpiry,
} from './tokens.js';

/** Lo que la API cuenta de un usuario. Nunca incluye la contraseña. */
export interface PublicUser {
  readonly id: string;
  readonly email: string;
}

export interface StartedSession {
  /** Identificador de sesión. Solo se entrega aquí, al iniciarla. */
  readonly token: string;
  readonly user: PublicUser;
}

/** Sesión válida encontrada a partir del identificador de una petición. */
export interface ActiveSession {
  readonly sessionId: string;
  readonly user: PublicUser;
}

const UNIQUE_VIOLATION = 'P2002';

function hasCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === code
  );
}

@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async register({ email, password }: Credentials): Promise<StartedSession> {
    const passwordHash = await hashPassword(password);
    try {
      const user = await this.prisma.user.create({
        data: { email, passwordHash },
        select: { id: true, email: true },
      });
      return await this.startSession(user);
    } catch (error) {
      if (hasCode(error, UNIQUE_VIOLATION)) {
        throw new ConflictException({
          message: 'Ya existe una cuenta con ese correo.',
          errors: { email: 'Ya existe una cuenta con ese correo.' },
        });
      }
      throw error;
    }
  }

  /**
   * Inicia sesión. Un correo que no existe y una contraseña incorrecta dan el
   * mismo error y tardan lo mismo, para no revelar qué correos tienen cuenta.
   */
  async login({ email, password }: Credentials): Promise<StartedSession> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const matches = await verifyPassword(
      password,
      user?.passwordHash ?? (await UNKNOWN_PASSWORD_HASH),
    );
    if (!user || !matches) {
      throw new UnauthorizedException({
        message: 'El correo o la contraseña no son correctos.',
      });
    }

    // De paso se limpian las sesiones caducadas de este usuario.
    await this.prisma.session.deleteMany({
      where: { userId: user.id, expiresAt: { lte: new Date() } },
    });
    return this.startSession({ id: user.id, email: user.email });
  }

  /** Devuelve la sesión de ese identificador, o null si no existe o caducó. */
  async findSession(token: string): Promise<ActiveSession | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      select: {
        id: true,
        expiresAt: true,
        user: { select: { id: true, email: true } },
      },
    });
    if (!session || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }
    return { sessionId: session.id, user: session.user };
  }

  /** Cierra una sesión: su identificador deja de valer. */
  async logout(sessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id: sessionId } });
  }

  /** Borra el usuario y, en cascada, sus tableros y todas sus sesiones. */
  async deleteAccount(userId: string): Promise<void> {
    await this.prisma.user.deleteMany({ where: { id: userId } });
  }

  private async startSession(user: PublicUser): Promise<StartedSession> {
    const token = createSessionToken();
    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: hashSessionToken(token),
        expiresAt: sessionExpiry(),
      },
    });
    return { token, user };
  }
}
