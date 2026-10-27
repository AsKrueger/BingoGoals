import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Prueba de humo en un navegador real, sobre la versión compilada. Cubre lo
// que los tests con jsdom no pueden ver: el foco de verdad, IndexedDB de
// verdad, el service worker y que nada se desborde a 360 px de ancho.

const storedV1: unknown = JSON.parse(
  readFileSync(
    new URL('../src/storage/fixtures/stored-v1.json', import.meta.url),
    'utf8',
  ),
);

/** Lo guardado en IndexedDB: versión del formato y un registro por tablero. */
function storedBoards(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ version: unknown; boards: unknown[] }>(
        (resolve, reject) => {
          const open = indexedDB.open('bingogoals');
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const database = open.result;
            if (!database.objectStoreNames.contains('boards')) {
              database.close();
              resolve({ version: undefined, boards: [] });
              return;
            }
            const transaction = database.transaction(['boards', 'meta']);
            const boards = transaction.objectStore('boards').getAll();
            const version = transaction.objectStore('meta').get('version');
            transaction.oncomplete = () => {
              database.close();
              resolve({ version: version.result, boards: boards.result });
            };
          };
        },
      ),
  );
}

/**
 * Deja guardado un registro único, como hacían las versiones 1 y 2, antes de
 * que la web abra la base de datos. Se hace desde otra página del mismo sitio.
 */
async function seedLegacyRecord(page: Page, value: unknown) {
  await page.goto('/manifest.webmanifest');
  await page.evaluate(
    (record) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('bingogoals', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('state');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const database = open.result;
          const transaction = database.transaction('state', 'readwrite');
          transaction.objectStore('state').put(record, 'app');
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
        };
      }),
    value,
  );
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, 'desbordamiento horizontal en píxeles').toBeLessThanOrEqual(
    0,
  );
}

test('crear un tablero, marcar, abrir un diálogo con el teclado y recargar', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'BingoGoals' })).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Crear un tablero de 5×5.
  await page.getByRole('button', { name: 'Empezar ahora' }).click();
  await expect(page.getByLabel('Título del tablero')).toBeFocused();
  await page.getByLabel('Título del tablero').fill('Metas de humo');
  await page.getByText('5 × 5').click();
  await page.keyboard.press('Enter');

  await expect(
    page.getByRole('heading', { name: 'Metas de humo' }),
  ).toBeVisible();
  const board = page.getByRole('group', { name: 'Tablero de bingo' });
  await expect(board.getByRole('button')).toHaveCount(25);
  await expect(page.getByText('1 de 25 conseguidos')).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Marcar una casilla.
  const cell = page.getByRole('button', { name: 'Objetivo 1', exact: true });
  await cell.click();
  await expect(cell).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('2 de 25 conseguidos')).toBeVisible();

  // Abrir un diálogo solo con el teclado y usarlo.
  const themeButton = page.getByRole('button', { name: 'Cambiar tema' });
  await themeButton.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Elige tu estilo' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Clásico' })).toBeFocused();
  await expectNoHorizontalScroll(page);

  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Navidad' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-theme]').first()).toHaveAttribute(
    'data-theme',
    'christmas',
  );

  // Tab no sale del diálogo; Escape lo cierra y devuelve el foco.
  for (let press = 0; press < 12; press++) {
    await page.keyboard.press('Tab');
  }
  await expect(dialog.locator(':focus')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(themeButton).toBeFocused();

  // Los cambios se guardan solos, en la versión actual del formato.
  await expect
    .poll(async () => JSON.stringify(await storedBoards(page)))
    .toContain('"theme":"christmas"');
  const saved = await storedBoards(page);
  expect(saved.version).toBe(3);
  expect(saved.boards).toHaveLength(1);

  // Recargar: todo sigue igual.
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Metas de humo' }),
  ).toBeVisible();
  await expect(page.getByText('2 de 25 conseguidos')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Objetivo 1', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-theme]').first()).toHaveAttribute(
    'data-theme',
    'christmas',
  );
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('los datos de la versión 1 se migran al abrir la web, sin aviso', async ({
  page,
}) => {
  // Se deja guardado un registro real de la versión 1 y se abre la web.
  await seedLegacyRecord(page, storedV1);
  await page.goto('/');

  // Los tableros siguen ahí, con su tablero activo y sin ningún aviso.
  await expect(page.getByRole('heading', { name: 'Segundo' })).toBeVisible();
  await expect(page.getByText('2 de 25 conseguidos')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);

  // Y ya han quedado guardados en la versión 3, un registro por tablero y
  // sin los campos antiguos.
  await expect.poll(async () => (await storedBoards(page)).version).toBe(3);
  const saved = await storedBoards(page);
  expect(saved.boards).toHaveLength(3);
  const stored = JSON.stringify(saved);
  expect(stored).not.toContain('primaryColor');
  expect(stored).toContain('updatedAt');

  // El otro tablero conserva su tema, su casilla personalizada y su foto.
  await page.getByRole('button', { name: 'Mis tableros' }).click();
  await expect(page.getByRole('listitem')).toHaveCount(2);
  await page.getByRole('button', { name: 'Abrir Primero' }).click();
  await expect(page.locator('[data-theme]').first()).toHaveAttribute(
    'data-theme',
    'sakura',
  );
  const customCell = page.getByRole('button', { name: 'Correr 10 km' });
  await expect(customCell).toHaveAttribute('aria-pressed', 'true');
  await expect(customCell).toHaveCSS('background-image', /data:image\/jpeg/);

  // El historial también.
  await page.getByRole('button', { name: 'Historial' }).click();
  await expect(
    page.getByRole('button', { name: 'Ver Archivado' }),
  ).toBeVisible();

  // Tras recargar sigue todo, ya sin nada que migrar.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Primero' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('la web abre sin conexión tras la primera visita', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Empezar ahora' }).click();
  await page.getByLabel('Título del tablero').fill('Sin conexión');
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Sin conexión' }),
  ).toBeVisible();

  // El service worker tiene que estar activo y controlando la página.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller !== null),
    )
    .toBe(true);
  await expect
    .poll(async () => JSON.stringify(await storedBoards(page)))
    .toContain('Sin conexión');

  await context.setOffline(true);
  await page.reload();

  await expect(
    page.getByRole('heading', { name: 'Sin conexión' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Objetivo 1', exact: true }).click();
  await expect(page.getByText('1 de 9 conseguidos')).toBeVisible();
});
