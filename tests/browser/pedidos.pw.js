import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { createApp } from '../../src/server/app.js';

let c, dir, server, base, token, plato;
const count = () => c.db.prepare('SELECT count(*) AS n FROM pedidos').get().n;
test.beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cartaya-browser-'));
  c = createApp({ databasePath: path.join(dir, 'test.sqlite'), mediaDir: path.join(dir, 'media'),
    password: 'test-password', sessionSecret: 'secreto-de-pruebas-largo', publicBaseUrl: 'http://127.0.0.1',
    mesas: ['uno'], production: false });
  const categoria = c.catalogo.crearCategoria({ nombre: 'Comida' });
  plato = c.catalogo.crearPlato({ categoriaId: categoria.id, nombre: 'Torta', descripcion: 'Pan', precioCentavos: 4500 });
  token = c.mesas.lista()[0].token;
  server = c.app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.afterEach(async () => {
  server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
  c.db.close(); fs.rmSync(dir, { recursive: true, force: true });
});
async function abrir(page) {
  await page.goto(`${base}/?mesa=${encodeURIComponent(token)}`);
  await expect(page.getByRole('heading', { name: 'Torta' })).toBeVisible();
  await page.getByRole('button', { name: '+' }).first().click();
}

test('precio vigente requiere otra confirmacion y registra el nuevo total', async ({ page }) => {
  await abrir(page);
  c.catalogo.editarPlato(plato.id, { precioCentavos: 5000 });
  await page.getByRole('button', { name: 'Confirmar pedido' }).click();
  await expect(page.getByText('Total: $50.00', { exact: true })).toBeVisible();
  expect(count()).toBe(0);
  await page.getByRole('button', { name: 'Confirmar pedido' }).click();
  await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible();
  expect(c.db.prepare('SELECT total_centavos FROM pedidos').get().total_centavos).toBe(5000);
});

test('plato retirado elimina la linea y evita un pedido vacio', async ({ page }) => {
  await abrir(page);
  c.catalogo.archivarPlato(plato.id);
  await page.getByRole('button', { name: 'Confirmar pedido' }).click();
  await expect(page.getByText('Total: $0.00')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar pedido' })).toBeDisabled();
  expect(count()).toBe(0);
});

test('dos pedidos independientes requieren dos confirmaciones', async ({ page }) => {
  await abrir(page);
  await page.getByRole('button', { name: 'Confirmar pedido' }).click();
  await expect(page.getByText(/N\u00famero 1/)).toBeVisible();
  await page.getByRole('button', { name: 'Hacer otro pedido' }).click();
  await expect(page.getByText(/A\u00fan no agregas platos/)).toBeVisible();
  expect(count()).toBe(1);
  await page.getByRole('button', { name: '+' }).first().click();
  expect(count()).toBe(1);
  await page.getByRole('button', { name: 'Confirmar pedido' }).click();
  await expect(page.getByText(/N\u00famero 2/)).toBeVisible();
  expect(count()).toBe(2);
});

test('respuesta perdida tras commit reintenta la misma clave sin duplicar', async ({ page }) => {
  await abrir(page);
  let original;
  await page.route('**/api/pedidos', async (route) => {
    original = JSON.parse(route.request().postData());
    await route.fetch();
    await route.abort();
  }, { times: 1 });
  await page.getByRole('button', { name: 'Confirmar pedido' }).click();
  await expect(page.getByRole('button', { name: /Reintentar el mismo/ })).toBeVisible();
  expect(count()).toBe(1);
  let retry;
  await page.route('**/api/pedidos', async (route) => {
    retry = JSON.parse(route.request().postData());
    await route.continue();
  }, { times: 1 });
  await page.getByRole('button', { name: /Reintentar el mismo/ }).click();
  await expect(page.getByText(/N\u00famero 1/)).toBeVisible();
  expect(retry).toEqual(original);
  expect(count()).toBe(1);
});
