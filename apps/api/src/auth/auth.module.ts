import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { RateLimiter } from './rate-limiter.js';

/**
 * Cuentas y sesiones. Exporta `AuthGuard` y `AuthService` para que otros
 * módulos puedan proteger sus rutas.
 */
@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, RateLimiter],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
