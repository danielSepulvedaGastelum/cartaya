import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { createApp } from '../src/server/app.js';

it('ensaya un respaldo SQLite consistente y reabre la copia sin alterar pedidos', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cartaya-backup-'));
  const config = { databasePath: path.join(dir, 'origen.sqlite'), mediaDir: path.join(dir, 'media'),
    password: 'test-password', sessionSecret: 'secreto-de-pruebas-largo', publicBaseUrl: 'http://localhost',
    mesas: ['uno'], production: false };
  let origen, copia;
  try {
    origen = createApp(config);
    const cat = origen.catalogo.crearCategoria({ nombre: 'Comida' });
    const dish = origen.catalogo.crearPlato({ categoriaId: cat.id, nombre: 'Pan', descripcion: 'Pan', precioCentavos: 1200 });
    const mesa = origen.mesas.lista()[0];
    const payload = { mesa: mesa.token, claveIdempotencia: 'intento', lineas: [
      { lineaId: 'a', platoId: dish.id, cantidad: 2, nota: 'sin sal', precioCentavos: 1200 }
    ] };
    expect(origen.pedidos.confirmar(payload).pedido.numero).toBe(1);
    const antes = origen.db.prepare('SELECT * FROM pedidos').all();
    const lineas = origen.db.prepare('SELECT * FROM pedido_lineas').all();
    const archivoCopia = path.join(dir, 'respaldo.sqlite');
    await origen.db.backup(archivoCopia);
    origen.db.close(); origen = null;
    copia = createApp({ ...config, databasePath: archivoCopia });
    expect(copia.db.prepare('SELECT * FROM pedidos').all()).toEqual(antes);
    expect(copia.db.prepare('SELECT * FROM pedido_lineas').all()).toEqual(lineas);
    expect(copia.db.pragma('foreign_key_check')).toEqual([]);
    copia.mesas.renombrar(mesa.id, { nombre: 'renombrada' });
    copia.mesas.desactivar(mesa.id);
    expect(copia.pedidos.confirmar(payload)).toMatchObject({ reintento: true, pedido: { numero: 1 } });
    expect(copia.db.prepare('SELECT count(*) AS n FROM pedidos').get().n).toBe(1);
  } finally {
    if (origen?.db.open) origen.db.close();
    if (copia?.db.open) copia.db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
