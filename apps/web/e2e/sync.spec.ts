import { expect, test, type Browser, type Page } from '@playwright/test';

// Prueba de humo de la sincronización: dos «dispositivos» (dos contextos del
// navegador, cada uno con su almacenamiento) con la misma cuenta, contra la
// API real y su PostgreSQL.

const PASSWORD = 'correcta-caballo';

function newEmail() {
  return `sync-${Date.now()}-${Math.round(Math.random() * 1e6)}@example.com`;
}

/** Otro dispositivo: un contexto nuevo, sin nada guardado. */
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

async function createBoard(page: Page, title: string) {
  // Hasta que termina la carga inicial no se sabe si hay tableros.
  await expect(
    page.getByRole('button', { name: /^(Empezar ahora|Mis tableros)$/ }),
  ).toBeVisible();
  const start = page.getByRole('button', { name: 'Empezar ahora' });
  if (await start.isVisible()) {
    await start.click();
  } else {
    await page.getByRole('button', { name: 'Mis tableros' }).click();
    await page.getByRole('button', { name: '+ Nuevo tablero' }).click();
  }
  await page.getByLabel('Título del tablero').fill(title);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
}

async function expectSynced(page: Page) {
  await expect(
    page.getByRole('status').filter({ hasText: /Sincroniz/ }),
  ).toHaveText(/Sincronizado/, { timeout: 15_000 });
}

test('lo que se hace en un dispositivo aparece en el otro', async ({
  page: a,
  browser,
}) => {
  const email = newEmail();

  // A: un tablero creado sin cuenta se sube al crear la cuenta.
  await a.goto('/');
  await createBoard(a, 'Metas compartidas');
  await signIn(a, 'Crear cuenta', email);
  await expectSynced(a);

  // B: al iniciar sesión, aparece.
  const b = await newDevice(browser);
  await b.goto('/');
  await signIn(b, 'Iniciar sesión', email);
  await expect(
    b.getByRole('heading', { name: 'Metas compartidas' }),
  ).toBeVisible({ timeout: 15_000 });

  // B marca una casilla; A la recibe al volver a abrirse.
  await b.getByRole('button', { name: 'Objetivo 1', exact: true }).click();
  await expectSynced(b);
  await a.reload();
  await expect(
    a.getByRole('button', { name: 'Objetivo 1', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 });

  // A archiva el tablero; B lo ve en el historial.
  await a.getByRole('button', { name: 'Ajustes' }).click();
  await a.getByRole('button', { name: 'Archivar tablero' }).click();
  await a.getByRole('dialog').getByRole('button', { name: 'Archivar' }).click();
  await expect(a.getByRole('heading', { name: 'BingoGoals' })).toBeVisible();
  await a.getByRole('button', { name: 'Cuenta' }).click();
  await a.getByRole('button', { name: 'Sincronizar ahora' }).click();
  await expect(a.getByText(/Sincronizado/)).toBeVisible({ timeout: 15_000 });

  await b.reload();
  await expect(b.getByRole('heading', { name: 'BingoGoals' })).toBeVisible({
    timeout: 15_000,
  });
  await b.getByRole('button', { name: 'Ver historial' }).click();
  await expect(
    b.getByRole('button', { name: 'Ver Metas compartidas' }),
  ).toBeVisible();

  // A lo elimina del historial; B deja de verlo.
  await a.getByRole('button', { name: 'Volver' }).click();
  await a.getByRole('button', { name: 'Ver historial' }).click();
  await a
    .getByRole('button', { name: 'Eliminar Metas compartidas del historial' })
    .click();
  await a.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click();
  await expect(a.getByText('Aún no tienes tableros archivados.')).toBeVisible();
  await a.getByRole('button', { name: 'Volver' }).click();
  await a.getByRole('button', { name: 'Cuenta' }).click();
  await a.getByRole('button', { name: 'Sincronizar ahora' }).click();
  await expect(a.getByText(/Sincronizado/)).toBeVisible({ timeout: 15_000 });

  await b.reload();
  await expect(b.getByRole('heading', { name: 'BingoGoals' })).toBeVisible();
  await expect(b.getByRole('button', { name: 'Ver historial' })).toHaveCount(
    0,
    {
      timeout: 15_000,
    },
  );
});

test('un cambio hecho sin conexión llega al otro dispositivo al reconectar', async ({
  page: a,
  context,
  browser,
}) => {
  const email = newEmail();
  await a.goto('/');
  await createBoard(a, 'Sin red');
  await signIn(a, 'Crear cuenta', email);
  await expectSynced(a);

  await context.setOffline(true);
  await a.getByRole('button', { name: 'Objetivo 5', exact: true }).click();
  await expect(a.getByText('1 de 9 conseguidos')).toBeVisible();
  await expect(
    a
      .getByRole('status')
      .filter({ hasText: /Sin conexión|Conectando|pendientes/ }),
  ).toBeVisible({ timeout: 15_000 });

  await context.setOffline(false);
  await expectSynced(a);

  const b = await newDevice(browser);
  await b.goto('/');
  await signIn(b, 'Iniciar sesión', email);
  await expect(
    b.getByRole('button', { name: 'Objetivo 5', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 });
});

test('dos pestañas del mismo navegador ven los cambios de la otra', async ({
  page: first,
  context,
}) => {
  await first.goto('/');
  await createBoard(first, 'Pestañas');
  const second = await context.newPage();
  await second.goto('/');
  await expect(second.getByRole('heading', { name: 'Pestañas' })).toBeVisible();

  await first.getByRole('button', { name: 'Objetivo 2', exact: true }).click();

  await expect(
    second.getByRole('button', { name: 'Objetivo 2', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(second.getByText('1 de 9 conseguidos')).toBeVisible();
});

test('otra cuenta no ve los tableros de la primera', async ({
  page: a,
  browser,
}) => {
  await a.goto('/');
  await createBoard(a, 'Solo de la primera');
  await signIn(a, 'Crear cuenta', newEmail());
  await expectSynced(a);

  const b = await newDevice(browser);
  await b.goto('/');
  await signIn(b, 'Crear cuenta', newEmail());
  await expect(b.getByRole('heading', { name: 'BingoGoals' })).toBeVisible();
  await expect(
    b.getByRole('heading', { name: 'Solo de la primera' }),
  ).toHaveCount(0);
});
