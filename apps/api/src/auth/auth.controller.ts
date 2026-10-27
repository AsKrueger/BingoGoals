import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CurrentSession, type AuthRequest } from './auth.guard.js';
import {
  AuthService,
  type ActiveSession,
  type StartedSession,
} from './auth.service.js';
import { parseCredentials, type Credentials } from './credentials.js';
import { RateLimiter } from './rate-limiter.js';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(RateLimiter) private readonly rateLimiter: RateLimiter,
  ) {}

  @Post('register')
  async register(
    @Body() body: unknown,
    @Req() request: AuthRequest,
  ): Promise<StartedSession> {
    this.rateLimiter.consume(`register:${request.ip}`);
    return this.auth.register(
      this.credentials(body, { checkPasswordRules: true }),
    );
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: unknown,
    @Req() request: AuthRequest,
  ): Promise<StartedSession> {
    const ipKey = `login:${request.ip}`;
    this.rateLimiter.consume(ipKey);
    const credentials = this.credentials(body, { checkPasswordRules: false });
    // También por correo: frena a quien prueba contraseñas contra una cuenta
    // desde muchas direcciones distintas.
    const emailKey = `login-email:${credentials.email}`;
    this.rateLimiter.consume(emailKey);

    const session = await this.auth.login(credentials);
    this.rateLimiter.reset(ipKey);
    this.rateLimiter.reset(emailKey);
    return session;
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentSession() session: ActiveSession) {
    return { user: session.user };
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async logout(@CurrentSession() session: ActiveSession): Promise<void> {
    await this.auth.logout(session.sessionId);
  }

  @Delete('account')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async deleteAccount(@CurrentSession() session: ActiveSession): Promise<void> {
    await this.auth.deleteAccount(session.user.id);
  }

  private credentials(
    body: unknown,
    options: { checkPasswordRules: boolean },
  ): Credentials {
    const result = parseCredentials(body, options);
    if (!result.ok) {
      throw new BadRequestException({
        message: 'Revisa los datos del formulario.',
        errors: result.errors,
      });
    }
    return result.credentials;
  }
}
