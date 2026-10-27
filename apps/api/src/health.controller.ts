import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';

/**
 * Commit que se está ejecutando. Render lo da en `RENDER_GIT_COMMIT`; el
 * despliegue lo usa para saber cuándo ha arrancado la versión nueva.
 */
export function runningVersion(env = process.env): string | null {
  return env.RENDER_GIT_COMMIT || null;
}

@Controller('health')
export class HealthController {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: Pick<PrismaService, 'isHealthy'>,
  ) {}

  /** Estado de la API y de su base de datos. Sin base de datos responde 503. */
  @Get()
  async getHealth() {
    if (!(await this.prisma.isHealthy())) {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'unavailable',
      });
    }
    return { status: 'ok', database: 'ok', version: runningVersion() };
  }
}
