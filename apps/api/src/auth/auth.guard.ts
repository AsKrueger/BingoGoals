import {
  createParamDecorator,
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { AuthService, type ActiveSession } from './auth.service.js';
import { bearerToken } from './tokens.js';

/** Lo que hace falta de la petición HTTP, sea cual sea el servidor. */
export interface AuthRequest {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  /** Lo rellena `AuthGuard` cuando la sesión es válida. */
  session?: ActiveSession;
}

/**
 * Protege una ruta: exige una sesión válida en la cabecera
 * `Authorization: Bearer <identificador>` y responde 401 si no la hay.
 *
 *     @UseGuards(AuthGuard)
 *     @Get('algo')
 *     algo(@CurrentSession() session: ActiveSession) { … }
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = bearerToken(request.headers.authorization);
    const session = token ? await this.auth.findSession(token) : null;
    if (!session) {
      throw new UnauthorizedException({
        message: 'Inicia sesión para continuar.',
      });
    }
    request.session = session;
    return true;
  }
}

/** La sesión de la petición, en una ruta protegida con `AuthGuard`. */
export const CurrentSession = createParamDecorator(
  (_: unknown, context: ExecutionContext): ActiveSession => {
    const { session } = context.switchToHttp().getRequest<AuthRequest>();
    if (!session) {
      throw new UnauthorizedException({
        message: 'Inicia sesión para continuar.',
      });
    }
    return session;
  },
);
