import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { createDatabase } from '../src/server/database.js';
import { createApp } from '../src/server/app.js';
import { mesaToken } from '../src/server/generate-qr.js';

it('Migra un archivo SQLite previo conservando pedidos, mesas, líneas, índices y secuencia', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cartaya-migracion-'));
  const archivo = path.join(dir, 'previa.sqlite'); let db;
  try {
    db = createDatabase(archivo);
    db.exec(`CREATE TABLE mesas (id INTEGER PRIMARY KEY);
      INSERT INTO mesas VALUES (7);
      INSERT INTO categorias (id, nombre) VALUES (1, 'Comida');
      INSERT INTO platos (id, categoria_id, nombre, descripcion, precio_centavos) VALUES (1, 1, 'Torta', 'Pan', 4500);
      DROP TABLE pedidos;
      CREATE TABLE pedidos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, mesa TEXT NOT NULL, mesa_id INTEGER REFERENCES mesas(id),
        estado TEXT NOT NULL DEFAULT 'recibido' CHECK(estado = 'recibido'),
        total_centavos INTEGER NOT NULL CHECK(total_centavos >= 0), clave_idempotencia TEXT NOT NULL,
        solicitud_hash TEXT NOT NULL, creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(mesa, clave_idempotencia));
      CREATE INDEX idx_pedidos_mesa_id_creado ON pedidos(mesa_id, creado_en, id);
      CREATE INDEX idx_personalizado ON pedidos(estado);
      INSERT INTO pedidos VALUES (42, 'Mesa siete', 7, 'recibido', 9000, 'clave', 'hash', '2026-01-01 08:00:00');
      INSERT INTO pedido_lineas (pedido_id, plato_id, nombre_plato, cantidad, nota, precio_unitario_centavos, subtotal_centavos)
        VALUES (42, 1, 'Torta', 2, 'Sin cebolla', 4500, 9000);
      UPDATE sqlite_sequence SET seq = 99 WHERE name = 'pedidos';`);
    const pedido = db.prepare('SELECT * FROM pedidos').get();
    const lineas = db.prepare('SELECT * FROM pedido_lineas').all(); db.close();
    db = createDatabase(archivo);
    expect(db.prepare('SELECT * FROM pedidos').all()).toEqual([{ ...pedido, en_preparacion_en: null, servido_en: null, cancelado_en: null }]);
    expect(db.prepare('SELECT * FROM pedido_lineas').all()).toEqual(lineas);
    expect(db.pragma('foreign_key_check')).toEqual([]); expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all().map((r) => r.name))
      .toEqual(expect.arrayContaining(['idx_pedidos_mesa_id_creado', 'idx_pedidos_mesa_creado', 'idx_pedido_lineas_pedido', 'idx_personalizado']));
    db.prepare("UPDATE pedidos SET estado = 'en_preparacion' WHERE id = 42").run();
    db.prepare("UPDATE pedidos SET estado = 'servido' WHERE id = 42").run();
    expect(() => db.prepare("UPDATE pedidos SET estado = 'cancelado'").run()).toThrow();
    expect(db.prepare("INSERT INTO pedidos (mesa, total_centavos, clave_idempotencia, solicitud_hash) VALUES ('Mesa siete', 0, 'otra', 'hash')").run().lastInsertRowid).toBe(100);
    db.close(); db = createDatabase(archivo); expect(db.prepare('SELECT count(*) AS n FROM pedidos').get().n).toBe(2);
  } finally { if (db?.open) db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});


it('una actualizacion desde unicidad por nombre conserva el reintento historico', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cartaya-identidad-'));
  const archivo = path.join(dir, 'anterior.sqlite'); let db, app;
  const secret = 'secreto-de-pruebas-largo';
  const lineas = [{ lineaId: 'a', platoId: 1, cantidad: 1, nota: null, precioCentavos: 4500 }];
  const hash = crypto.createHash('sha256').update(JSON.stringify(lineas)).digest('hex');
  try {
    db = createDatabase(archivo);
    db.prepare('INSERT INTO categorias (id, nombre) VALUES (1, ?)').run('Comida');
    db.prepare('INSERT INTO platos (id, categoria_id, nombre, descripcion, precio_centavos) VALUES (1, 1, ?, ?, 4500)').run('Torta', 'Pan');
    db.prepare('INSERT INTO pedidos (id, mesa, total_centavos, clave_idempotencia, solicitud_hash) VALUES (42, ?, 4500, ?, ?)').run('uno', 'intento', hash);
    db.prepare('INSERT INTO pedido_lineas (pedido_id, plato_id, nombre_plato, cantidad, nota, precio_unitario_centavos, subtotal_centavos) VALUES (42, 1, ?, 1, NULL, 4500, 4500)').run('Torta');
    db.close(); db = null;
    app = createApp({ databasePath: archivo, mediaDir: path.join(dir, 'media'), password: 'clave',
      sessionSecret: secret, publicBaseUrl: 'http://localhost', mesas: ['uno'], production: false });
    const result = app.pedidos.confirmar({ mesa: mesaToken('uno', secret), claveIdempotencia: 'intento', lineas });
    expect(result).toMatchObject({ reintento: true, pedido: { numero: 42, totalCentavos: 4500 } });
    expect(app.db.prepare('SELECT count(*) AS n FROM pedidos').get().n).toBe(1);
    expect(app.db.prepare('SELECT count(*) AS n FROM pedido_lineas').get().n).toBe(1);
  } finally { if (db?.open) db.close(); if (app?.db.open) app.db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
