import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Put,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CurrentSession } from '../auth/auth.guard.js';
import type { ActiveSession } from '../auth/auth.service.js';
import { parsePhotoUpload } from './photo-upload.js';
import { PhotosService } from './photos.service.js';

/**
 * Fotos de las casillas. Cada usuario solo lee y sube las suyas. No hay ruta
 * para borrarlas: se borran solas cuando ninguna casilla las usa.
 */
@Controller('photos')
@UseGuards(AuthGuard)
export class PhotosController {
  constructor(@Inject(PhotosService) private readonly photos: PhotosService) {}

  /**
   * Sube una foto, con el archivo tal cual como cuerpo. Subirla dos veces no
   * cambia nada; responde 409 si el identificador es de una foto de otro.
   */
  @Put(':id')
  @HttpCode(204)
  async put(
    @CurrentSession() session: ActiveSession,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ): Promise<void> {
    const upload = parsePhotoUpload(body);
    if (!upload.ok) {
      throw new BadRequestException({ message: upload.message });
    }
    const result = await this.photos.put(session.user.id, id, upload.value);
    if (result === 'taken') {
      throw new ConflictException({ message: 'Esa foto ya existe.' });
    }
  }

  /** Descarga una foto. Como nunca cambia, se puede guardar en caché. */
  @Get(':id')
  @Header('Cache-Control', 'private, max-age=31536000, immutable')
  async get(
    @CurrentSession() session: ActiveSession,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<StreamableFile> {
    const photo = await this.photos.get(session.user.id, id);
    if (!photo) {
      // Una foto de otro usuario se trata como si no existiera.
      throw new NotFoundException({ message: 'La foto no existe.' });
    }
    return new StreamableFile(photo.data, {
      type: photo.type,
      length: photo.data.length,
    });
  }
}
