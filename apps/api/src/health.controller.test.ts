import { expect, test } from 'vitest';
import { HealthController } from './health.controller.js';

test('el endpoint de estado responde ok', () => {
  expect(new HealthController().getHealth()).toEqual({ status: 'ok' });
});
