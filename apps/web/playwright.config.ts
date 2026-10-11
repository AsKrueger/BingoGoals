import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
// El puerto por defecto de la API: la web compilada la busca ahí.
const API_PORT = 3000;

// Prueba de humo: abre la versión compilada en un navegador real. Antes de
// ejecutarla hay que compilar (`npm run build`); `npm run test:e2e` desde la
// raíz lo hace todo.
export default defineConfig({
  testDir: 'e2e',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      // El ancho más estrecho para el que se diseña la web.
      name: 'movil-360',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 360, height: 760 },
      },
    },
  ],
  webServer: [
    {
      command: `npm run preview -- --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
    },
    {
      // La API compilada, para la prueba de las cuentas. Necesita PostgreSQL
      // en marcha y migrado: `GET /health` solo responde bien con él.
      command: 'npm run start --workspace @bingogoals/api',
      cwd: '../..',
      url: `http://localhost:${API_PORT}/health`,
      env: {
        PORT: String(API_PORT),
        CORS_ORIGINS: `http://localhost:${PORT}`,
        // La prueba registra e inicia sesión varias veces seguidas.
        AUTH_RATE_LIMIT_MAX: '100',
      },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
