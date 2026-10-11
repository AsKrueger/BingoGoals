import { ServiceUnavailableException } from '@nestjs/common';
import { expect, test } from 'vitest';
import { HealthController } from './health.controller.js';

function controller(databaseIsHealthy: boolean) {
  return new HealthController({ isHealthy: async () => databaseIsHealthy });
}

test('con la base de datos disponible responde ok', async () => {
  expect(await controller(true).getHealth()).toEqual({
    status: 'ok',
    database: 'ok',
  });
});

test('sin base de datos responde 503 con el detalle', async () => {
  const error = await controller(false)
    .getHealth()
    .catch((reason: unknown) => reason);

  expect(error).toBeInstanceOf(ServiceUnavailableException);
  const exception = error as ServiceUnavailableException;
  expect(exception.getStatus()).toBe(503);
  expect(exception.getResponse()).toEqual({
    status: 'error',
    database: 'unavailable',
  });
});
