import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PhotosModule } from '../photos/photos.module.js';
import { BoardsController } from './boards.controller.js';
import { BoardsService } from './boards.service.js';

@Module({
  imports: [AuthModule, PhotosModule],
  controllers: [BoardsController],
  providers: [BoardsService],
})
export class BoardsModule {}
