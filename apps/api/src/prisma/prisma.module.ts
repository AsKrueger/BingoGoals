import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

/** Pone el cliente de la base de datos al alcance de toda la API. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
