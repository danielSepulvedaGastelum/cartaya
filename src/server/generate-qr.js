import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import { getConfig } from './config.js';

export function mesaToken(mesa, secret) {
  return crypto.createHmac('sha256', secret).update(`mesa:${mesa}`).digest('base64url').slice(0, 20);
}

export async function generateQrs(config, outputDir = path.resolve(process.cwd(), 'qr'), mesas = config.mesas) {
  fs.mkdirSync(outputDir, { recursive: true });
  const generated = [];
  for (const mesaActual of mesas) {
    const mesa = typeof mesaActual === 'string' ? mesaActual : mesaActual.nombre;
    const token = typeof mesaActual === 'string' ? mesaToken(mesa, config.sessionSecret) : mesaActual.token;
    const url = new URL('/', config.publicBaseUrl);
    url.searchParams.set('mesa', token);
    const filename = path.join(outputDir, `${mesa.replace(/[^a-z0-9_-]/gi, '-')}.png`);
    await QRCode.toFile(filename, url.toString(), { width: 900, margin: 2, errorCorrectionLevel: 'H' });
    generated.push({ mesa, token, url: url.toString(), filename });
  }
  return generated;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(.:)/, '$1'))) {
  const config = getConfig();
  const { createDatabase } = await import('./database.js');
  const { createMesas } = await import('./mesas.js');
  const db = createDatabase(config.databasePath);
  const generated = await generateQrs(config, undefined, createMesas(db, config).lista().filter((mesa) => mesa.activa));
  db.close();
  generated.forEach(({ mesa, url, filename }) => console.log(`${mesa}: ${url} -> ${filename}`));
}
