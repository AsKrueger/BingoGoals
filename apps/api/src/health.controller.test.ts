import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, expect, test, vi } from 'vitest';
import { HealthController, runningVersion } from './health.controller.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

function controller(databaseIsHealthy: boolean) {
  return new HealthController({ isHealthy: async () => databaseIsHealthy });
}

test('con la base de datos disponible responde ok', async () => {
  vi.stubEnv('RENDER_GIT_COMMIT', '');

  expect(await controller(true).getHealth()).toEqual({
    status: 'ok',
    database: 'ok',
    version: null,
  });
});

test('indica el commit desplegado cuando el proveedor lo da', async () => {
  vi.stubEnv('RENDER_GIT_COMMIT', 'fb46a58');

  expect((await controller(true).getHealth()).version).toBe('fb46a58');
  expect(runningVersion({})).toBeNull();
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
