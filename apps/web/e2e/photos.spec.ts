import { expect, test, type Browser, type Page } from '@playwright/test';

// Prueba de humo de las fotos: dos «dispositivos» con la misma cuenta, contra
// la API real y su PostgreSQL. La foto se reduce con el lienzo del navegador.

const PASSWORD = 'correcta-caballo';
const API = 'http://localhost:3000';

/** Una imagen PNG de 2 × 2 píxeles. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP4z8DAwPAfhP7/ZwAAHu8E/Gj7YDYAAAAASUVORK5CYII=',
  'base64',
);

function newEmail() {
  return `fotos-${Date.now()}-${Math.round(Math.random() * 1e6)}@example.com`;
}

async function newDevice(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    baseURL: 'http://localhost:4173',
    viewport: { width: 360, height: 760 },
  });
  return context.newPage();
}

async function signIn(
  page: Page,
  mode: 'Crear cuenta' | 'Iniciar sesión',
  email: string,
) {
  await page.getByRole('button', { name: 'Cuenta' }).click();
  await page.getByRole('button', { name: mode }).click();
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(PASSWORD);
  await page.keyboard.press('Enter');
  await expect(page.getByText('Sesión iniciada')).toBeVisible();
  await page.getByRole('button', { name: 'Volver' }).click();
}

/** La sesión guardada en el dispositivo, para preguntar a la API. */
function tokenOf(page: Page): Promise<string> {
  return page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      const value = localStorage.getItem(key) ?? '';
      const token = /"token":"([^"]+)"/.exec(value)?.[1];
      if (token) {
        return token;
      }
    }
    throw new Error('No hay sesión guardada.');
  });
}

/** Fotos que usa la casilla según el servidor, y si el servidor las tiene. */
async function serverPhoto(page: Page, token: string) {
  const reply = await page.request.get(`${API}/boards`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { boards } = (await reply.json()) as {
    boards: { board: { cells: { photoId: string | null }[] } }[];
  };
  const photoId = boards[0]?.board.cells[0]?.photoId ?? null;
  return photoId;
}

async function photoStatus(page: Page, token: string, id: string) {
  const reply = await page.request.get(`${API}/photos/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return reply.status();
}

async function choosePhoto(page: Page) {
  await page.getByRole('button', { name: /Editar casillas/ }).click();
  await page.getByRole('button', { name: 'Editar: Objetivo 1' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/foto/).setInputFiles({
    name: 'foto.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await expect(dialog.getByAltText('Foto elegida')).toBeVisible();
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await page.getByRole('button', { name: /Editar casillas/ }).click();
}

async function syncNow(page: Page) {
  await page.getByRole('button', { name: 'Cuenta' }).click();
  await page.getByRole('button', { name: 'Sincronizar ahora' }).click();
  await expect(page.getByText(/Sincronizado/)).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Volver' }).click();
}

const firstCell = (page: Page) =>
  page.getByRole('button', { name: 'Objetivo 1', exact: true });

test('una foto viaja entre dispositivos y la antigua se borra del servidor', async ({
  page: a,
  browser,
}) => {
  const email = newEmail();
  await a.goto('/');
  await a.getByRole('button', { name: 'Empezar ahora' }).click();
  await a.getByLabel('Título del tablero').fill('Con fotos');
  await a.keyboard.press('Enter');
  await signIn(a, 'Crear cuenta', email);
  const token = await tokenOf(a);

  // A elige una foto: se ve al momento y llega al servidor.
  await choosePhoto(a);
  await expect(firstCell(a)).toHaveCSS('background-image', /blob:/);
  await expect
    .poll(() => serverPhoto(a, token), { timeout: 15_000 })
    .not.toBeNull();
  const first = (await serverPhoto(a, token)) as string;
  await expect.poll(() => photoStatus(a, token, first)).toBe(200);

  // B inicia sesión y la recibe.
  const b = await newDevice(browser);
  await b.goto('/');
  await signIn(b, 'Iniciar sesión', email);
  await expect(firstCell(b)).toHaveCSS('background-image', /blob:/, {
    timeout: 15_000,
  });

  // A la cambia: B ve la nueva y el servidor borra la anterior.
  await choosePhoto(a);
  await expect
    .poll(() => serverPhoto(a, token), { timeout: 15_000 })
    .not.toBe(first);
  const second = (await serverPhoto(a, token)) as string;
  await expect.poll(() => photoStatus(a, token, second)).toBe(200);
  // El servidor la borra justo después de guardar el tablero.
  await expect.poll(() => photoStatus(a, token, first)).toBe(404);
  await syncNow(b);
  await expect(firstCell(b)).toHaveCSS('background-image', /blob:/);

  // A la quita: desaparece en B y del servidor.
  await a.getByRole('button', { name: /Editar casillas/ }).click();
  await a.getByRole('button', { name: 'Editar: Objetivo 1' }).click();
  await a.getByRole('button', { name: 'Quitar foto' }).click();
  await a.getByRole('button', { name: 'Guardar' }).click();
  await expect
    .poll(() => serverPhoto(a, token), { timeout: 15_000 })
    .toBeNull();
  await expect.poll(() => photoStatus(a, token, second)).toBe(404);
  await syncNow(b);
  await expect(firstCell(b)).toHaveCSS('background-image', 'none');
});

test('un archivo que no es una imagen se rechaza con un aviso', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Empezar ahora' }).click();
  await page.getByLabel('Título del tablero').fill('Sin fotos');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: /Editar casillas/ }).click();
  await page.getByRole('button', { name: 'Editar: Objetivo 1' }).click();

  await page
    .getByRole('dialog')
    .getByLabel(/foto/)
    .setInputFiles({
      name: 'notas.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('esto no es una foto'),
    });

  await expect(page.getByRole('alert')).toHaveText(
    'No se ha podido leer la foto. Prueba con otra imagen.',
  );
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(
    page.getByRole('button', { name: 'Editar: Objetivo 1' }),
  ).toHaveCSS('background-image', 'none');
});
