import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { test, expect } from '@playwright/test';
import { createApp } from '../../src/server/app.js';

test('cinco cargas frias bajo perfil movil y fotos diferidas', async ({ browser }, testInfo) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cartaya-perf-'));
  const config = { databasePath: path.join(dir, 'test.sqlite'), mediaDir: path.join(dir, 'media'),
    password: 'test-password', sessionSecret: 'secreto-de-pruebas-largo', publicBaseUrl: 'http://127.0.0.1',
    mesas: [], production: false };
  const c = createApp(config);
  const pixels = Buffer.alloc(640 * 420 * 3);
  let seed = 77;
  for (let index = 0; index < pixels.length; index += 3) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const shade = seed % 75;
    pixels[index] = 115 + shade; pixels[index + 1] = 75 + shade; pixels[index + 2] = 40 + shade;
  }
  const webp = await sharp(pixels, { raw: { width: 640, height: 420, channels: 3 } }).webp({ quality: 72 }).toBuffer();
  fs.mkdirSync(config.mediaDir, { recursive: true });
  fs.writeFileSync(path.join(config.mediaDir, 'primera.webp'), webp);
  for (const item of [4, 5]) fs.writeFileSync(path.join(config.mediaDir, `lejana-${item}.webp`), webp);
  for (let category = 1; category <= 6; category++) {
    const cat = c.catalogo.crearCategoria({ nombre: `Categoria ${category}` });
    for (let item = 1; item <= 5; item++) {
      const dish = c.catalogo.crearPlato({ categoriaId: cat.id, nombre: `Plato ${category}-${item}`,
        descripcion: `Descripcion representativa ${category}-${item}`, precioCentavos: 3000 + 250 * item,
        alergenos: item % 2 ? [3] : [] });
      if (category === 1 && item === 1) c.catalogo.asignarFoto(dish.id, '/media/primera.webp');
      if (category === 6 && item >= 4) c.catalogo.asignarFoto(dish.id, `/media/lejana-${item}.webp`);
    }
  }
  const server = c.app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const runs = [];
  try {
    for (let i = 1; i <= 5; i++) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150,
        downloadThroughput: 4 * 1024 * 1024 / 8, uploadThroughput: 1024 * 1024 / 8 });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const requests = [];
      page.on('request', (request) => requests.push(request.url()));
      await context.tracing.start({ screenshots: true, snapshots: true });
      await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Categoria 1' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Plato 1-1' })).toBeVisible();
      await expect(page.getByText('Descripcion representativa 1-1')).toBeVisible();
      await expect(page.locator('.plato').first().getByText('$32.50')).toBeVisible();
      const elapsed = await page.evaluate(() => performance.now());
      const beforeScroll = [...requests];
      expect(beforeScroll.some((url) => /\/media\/lejana-[45]\.webp$/.test(url))).toBe(false);
      await page.getByRole('heading', { name: 'Plato 6-5' }).scrollIntoViewIfNeeded();
      await expect(page.locator('img[src="/media/lejana-4.webp"]')).toBeVisible();
      await expect(page.locator('img[src="/media/lejana-5.webp"]')).toBeVisible();
      const resources = await page.evaluate(() => performance.getEntriesByType('resource').map((item) => ({ name: item.name, transferSize: item.transferSize })));
      await context.tracing.stop({ path: testInfo.outputPath(`carta-${i}.zip`) });
      await page.screenshot({ path: testInfo.outputPath(`carta-${i}.png`) });
      runs.push({ numero: i, milisegundos: Math.round(elapsed), requests: beforeScroll, resources });
      await context.close();
    }
    const report = { platform: process.platform, release: os.release(), cpu: os.cpus()[0]?.model,
      chromium: browser.version(), viewport: '390x844', downloadMbps: 4, uploadMbps: 1, latencyMs: 150,
      cpuSlowdown: 4, fixture: { categorias: 6, platos: 30, fotosWebp: { cantidad: 3, width: 640, height: 420, bytesCadaUna: webp.length } }, runs };
    fs.writeFileSync(testInfo.outputPath('rendimiento-carta.json'), JSON.stringify(report, null, 2));
    expect(runs.every((run) => run.milisegundos < 2000)).toBe(true);
  } finally {
    server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
    c.db.close(); fs.rmSync(dir, { recursive: true, force: true });
  }
});
