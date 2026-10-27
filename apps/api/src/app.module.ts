import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { BoardsModule } from './boards/boards.module.js';
import { HealthController } from './health.controller.js';
import { PhotosModule } from './photos/photos.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, AuthModule, BoardsModule, PhotosModule],
  controllers: [HealthController],
})
export class AppModule {}
