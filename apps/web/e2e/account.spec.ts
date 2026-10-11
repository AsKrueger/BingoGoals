import { expect, test, type Page } from '@playwright/test';

// Prueba de humo de las cuentas: la web compilada contra la API real y su
// PostgreSQL. Playwright arranca los dos servidores (ver playwright.config.ts).

const API_URL = 'http://localhost:3000';
const PASSWORD = 'correcta-caballo';
const SAME_ERROR = 'El correo o la contraseña no son correctos.';

/** Un correo distinto en cada ejecución, para no chocar con cuentas previas. */
function newEmail() {
  return `humo-${Date.now()}-${Math.round(Math.random() * 1e6)}@example.com`;
}

async function fillForm(page: Page, email: string, password: string) {
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.keyboard.press('Enter');
}

function storedToken(page: Page) {
  return page.evaluate(() => {
    const stored = localStorage.getItem('bingogoals.session');
    return stored ? (JSON.parse(stored) as { token: string }).token : null;
  });
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, 'desbordamiento horizontal en píxeles').toBeLessThanOrEqual(
    0,
  );
}

test('registrarse, recargar, cerrar sesión, iniciar sesión y borrar la cuenta', async ({
  page,
  request,
}) => {
  const email = newEmail();
  const main = page.getByRole('main');

  // Registrarse con un correo nuevo.
  await page.goto('/');
  await page.getByRole('button', { name: 'Cuenta' }).click();
  await expect(page.getByText('La cuenta es opcional')).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByLabel('Correo')).toBeFocused();
  await expectNoHorizontalScroll(page);
  await fillForm(page, email, PASSWORD);

  // Sesión iniciada: la cuenta muestra el correo.
  await expect(page.getByText('Sesión iniciada')).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await expectNoHorizontalScroll(page);
  const token = await storedToken(page);
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(
    (
      await request.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).status(),
  ).toBe(200);

  // Recargar: la sesión sigue activa.
  await page.reload();
  await page.getByRole('button', { name: 'Cuenta' }).click();
  await expect(page.getByText('Sesión iniciada')).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  // Cerrar sesión: el identificador antiguo deja de valer en el servidor.
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByText('Sin cuenta')).toBeVisible();
  expect(await storedToken(page)).toBeNull();
  expect(
    (
      await request.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).status(),
  ).toBe(401);

  // Registrarse otra vez con el mismo correo: error junto al campo.
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await fillForm(page, email.toUpperCase(), 'otra-contraseña');
  await expect(page.getByRole('alert')).toHaveText(
    'Ya existe una cuenta con ese correo.',
  );
  await expect(page.getByLabel('Correo')).toHaveAttribute(
    'aria-invalid',
    'true',
  );

  // Iniciar sesión: contraseña incorrecta y correo inexistente, mismo mensaje.
  await main.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(
    page.getByRole('heading', { name: 'Iniciar sesión' }),
  ).toBeVisible();
  await fillForm(page, email, 'incorrecta-incorrecta');
  await expect(page.getByRole('alert')).toHaveText(SAME_ERROR);
  await fillForm(page, newEmail(), PASSWORD);
  await expect(page.getByRole('alert')).toHaveText(SAME_ERROR);

  // Con la contraseña correcta entra.
  await fillForm(page, email, PASSWORD);
  await expect(page.getByText('Sesión iniciada')).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  // Borrar la cuenta: pide confirmación, y se confirma con el teclado.
  await page.getByRole('button', { name: 'Borrar cuenta' }).click();
  const dialog = page.getByRole('dialog', { name: '¿Borrar tu cuenta?' });
  await expect(dialog).toContainText(email);
  await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await expectNoHorizontalScroll(page);
  await page.keyboard.press('Tab');
  await expect(
    dialog.getByRole('button', { name: 'Borrar cuenta' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Sin cuenta')).toBeVisible();

  // El usuario ya no existe: no se puede entrar con sus datos.
  await main.getByRole('button', { name: 'Iniciar sesión' }).click();
  await fillForm(page, email, PASSWORD);
  await expect(page.getByRole('alert')).toHaveText(SAME_ERROR);
});

test('sin cuenta todo funciona, y con cuenta los tableros no se tocan', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Empezar ahora' }).click();
  await page.getByLabel('Título del tablero').fill('Con cuenta');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Objetivo 1', exact: true }).click();
  await expect(page.getByText('1 de 9 conseguidos')).toBeVisible();
  // La barra de secciones, ahora con cinco botones, cabe a 360 px.
  await expectNoHorizontalScroll(page);

  await page.getByRole('button', { name: 'Cuenta' }).click();
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await fillForm(page, newEmail(), PASSWORD);
  await expect(page.getByText('Sesión iniciada')).toBeVisible();

  await page.getByRole('button', { name: 'Volver' }).click();
  await expect(page.getByRole('heading', { name: 'Con cuenta' })).toBeVisible();
  await expect(page.getByText('1 de 9 conseguidos')).toBeVisible();
});

test('con la API apagada la web sigue funcionando y la cuenta lo avisa', async ({
  page,
}) => {
  // Se inicia sesión con la API en marcha…
  await page.goto('/');
  await page.getByRole('button', { name: 'Cuenta' }).click();
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  const email = newEmail();
  await fillForm(page, email, PASSWORD);
  await expect(page.getByText('Sesión iniciada')).toBeVisible();

  // …y a partir de aquí la API deja de responder.
  await page.route(`${API_URL}/**`, (route) => route.abort());
  await page.reload();

  // La web funciona entera: se crea un tablero y se marca una casilla.
  await page.getByRole('button', { name: 'Empezar ahora' }).click();
  await page.getByLabel('Título del tablero').fill('Sin servidor');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Objetivo 1', exact: true }).click();
  await expect(page.getByText('1 de 9 conseguidos')).toBeVisible();

  // La cuenta conserva la sesión y avisa de que no hay conexión.
  await page.getByRole('button', { name: 'Cuenta' }).click();
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByRole('status')).toContainText(
    'No hay conexión con el servidor.',
  );
  await expectNoHorizontalScroll(page);

  // Al volver la API, reintentar quita el aviso.
  await page.unroute(`${API_URL}/**`);
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.getByText('Sesión iniciada')).toBeVisible();
});
