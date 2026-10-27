import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

/** Tiempo máximo para abrir una conexión con la base de datos. */
const CONNECTION_TIMEOUT_MS = 3000;
/** Tiempo máximo que espera la comprobación de estado. */
const HEALTH_TIMEOUT_MS = 3000;

/**
 * Cliente de la base de datos. No conecta al arrancar: la API se levanta
 * aunque la base de datos no esté disponible, y `GET /health` lo refleja.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
      }),
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /** true si la base de datos responde a tiempo. Nunca lanza ni se cuelga. */
  async isHealthy(timeoutMs = HEALTH_TIMEOUT_MS): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Tiempo agotado.')), timeoutMs);
    });

    try {
      await Promise.race([this.$queryRaw`SELECT 1`, timeout]);
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}
