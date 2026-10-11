import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';

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
    return { status: 'ok', database: 'ok' };
  }
}
