import crypto from 'node:crypto';
import { mesaToken } from './generate-qr.js';

function nombreValido(nombre) {
  if (typeof nombre !== 'string' || !nombre.trim()) throw new Error('El nombre de la mesa es obligatorio');
  return nombre.trim();
}

function serializar(row, publicBaseUrl) {
  const url = new URL('/', publicBaseUrl);
  url.searchParams.set('mesa', row.token);
  return { id: row.id, nombre: row.nombre, token: row.token, activa: Boolean(row.activa), url: url.toString() };
}

export function createMesas(db, config) {
  const foreignKeys = db.pragma('foreign_keys', { simple: true });
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS mesas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(trim(nombre)) > 0),
          token TEXT NOT NULL UNIQUE,
          activa INTEGER NOT NULL DEFAULT 1 CHECK(activa IN (0, 1)),
          creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          actualizado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      const columns = db.prepare('PRAGMA table_info(pedidos)').all().map((column) => column.name);
      const mesaIdNueva = !columns.includes('mesa_id');
      if (mesaIdNueva) db.exec('ALTER TABLE pedidos ADD COLUMN mesa_id INTEGER REFERENCES mesas(id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_pedidos_mesa_id_creado ON pedidos(mesa_id, creado_en, id)');

      if (db.prepare('SELECT COUNT(*) AS total FROM mesas').get().total === 0) {
        const insert = db.prepare('INSERT OR IGNORE INTO mesas (nombre, token) VALUES (?, ?)');
        (config.mesas || []).forEach((nombre) => insert.run(nombre, mesaToken(nombre, config.sessionSecret)));
      }
      if (mesaIdNueva) db.prepare(`UPDATE pedidos SET mesa_id = (SELECT id FROM mesas WHERE mesas.nombre = pedidos.mesa COLLATE NOCASE) WHERE mesa_id IS NULL`).run();
      migrarIdentidadPedidos(db);
    })();
  } finally {
    db.pragma(`foreign_keys = ${foreignKeys ? 'ON' : 'OFF'}`);
  }

  const rowById = db.prepare('SELECT * FROM mesas WHERE id = ?');
  const rowByToken = db.prepare('SELECT * FROM mesas WHERE token = ?');
  const listRows = db.prepare('SELECT * FROM mesas ORDER BY activa DESC, nombre COLLATE NOCASE, id');

  function lista() { return listRows.all().map((row) => serializar(row, config.publicBaseUrl)); }
  function porId(id) { const row = rowById.get(id); return row ? serializar(row, config.publicBaseUrl) : null; }
  function porToken(token) { const row = typeof token === 'string' ? rowByToken.get(token) : null; return row ? serializar(row, config.publicBaseUrl) : null; }
  function crear({ nombre }) {
    const result = db.prepare('INSERT INTO mesas (nombre, token) VALUES (?, ?)').run(nombreValido(nombre), crypto.randomBytes(18).toString('base64url'));
    return porId(result.lastInsertRowid);
  }
  function renombrar(id, { nombre }) {
    const result = db.prepare("UPDATE mesas SET nombre = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?").run(nombreValido(nombre), id);
    return result.changes ? porId(id) : null;
  }
  function cambiarEstado(id, activa) {
    const result = db.prepare('UPDATE mesas SET activa = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?').run(activa ? 1 : 0, id);
    return result.changes ? porId(id) : null;
  }
  function historial(id) {
    if (!rowById.get(id)) return null;
    const pedidos = db.prepare(`SELECT id, mesa, estado, total_centavos, creado_en FROM pedidos WHERE mesa_id = ? ORDER BY creado_en DESC, id DESC`).all(id);
    const lineas = db.prepare(`SELECT pedido_id, nombre_plato, cantidad, nota, precio_unitario_centavos, subtotal_centavos
      FROM pedido_lineas WHERE pedido_id IN (SELECT id FROM pedidos WHERE mesa_id = ?) ORDER BY pedido_id DESC, id`).all(id);
    const byOrder = new Map(pedidos.map((pedido) => [pedido.id, { numero: pedido.id, mesa: pedido.mesa, estado: pedido.estado, totalCentavos: pedido.total_centavos, creadoEn: pedido.creado_en, lineas: [] }]));
    lineas.forEach((linea) => byOrder.get(linea.pedido_id)?.lineas.push({ nombre: linea.nombre_plato, cantidad: linea.cantidad, nota: linea.nota, precioUnitarioCentavos: linea.precio_unitario_centavos, subtotalCentavos: linea.subtotal_centavos }));
    return [...byOrder.values()];
  }

  return { lista, porId, porToken, crear, renombrar, desactivar: (id) => cambiarEstado(id, false), reactivar: (id) => cambiarEstado(id, true), historial };
}


function migrarIdentidadPedidos(db) {
  const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'pedidos'").all().map(({ name }) => name);
  const oldTable = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'pedidos'").get().sql;
  if (indexes.includes('idx_pedidos_mesa_intento')) {
    if (!indexes.includes('idx_pedidos_legacy_intento') || /UNIQUE\s*\(\s*mesa\s*,\s*clave_idempotencia\s*\)/i.test(oldTable)) {
      throw new Error('La migraci\u00f3n de idempotencia tiene marcadores inconsistentes');
    }
    return;
  }

  // Los registros sin mesa_id en una instalación ya persistida no se asignan por
  // coincidencia de nombre: ese nombre pudo haber cambiado o haberse reutilizado.
  const rows = db.prepare('SELECT * FROM pedidos ORDER BY id').all();
  const invalid = db.prepare(`SELECT p.id FROM pedidos p LEFT JOIN mesas m ON m.id = p.mesa_id
    WHERE p.mesa_id IS NOT NULL AND m.id IS NULL`).all().map(({ id }) => id);
  const duplicates = db.prepare(`SELECT mesa_id, clave_idempotencia, group_concat(id) AS ids
    FROM pedidos WHERE mesa_id IS NOT NULL GROUP BY mesa_id, clave_idempotencia HAVING count(*) > 1`).all();
  if (invalid.length || duplicates.length) {
    throw new Error(`La migración de idempotencia requiere revisión: referencias ${invalid.join(', ') || 'ninguna'}; duplicados ${duplicates.map(({ ids }) => ids).join('; ') || 'ninguno'}`);
  }
  if (!/UNIQUE\s*\(\s*mesa\s*,\s*clave_idempotencia\s*\)/i.test(oldTable)) {
    // Una base nueva podría tener ya la tabla actualizada y requerir solo índices.
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_mesa_intento ON pedidos(mesa_id, clave_idempotencia) WHERE mesa_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_legacy_intento ON pedidos(mesa, clave_idempotencia) WHERE mesa_id IS NULL`);
    return;
  }
  const savedIndexes = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'pedidos' AND sql IS NOT NULL").all()
    .map(({ sql }) => sql);
  const sequence = db.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'pedidos'").get()?.seq;
  const columns = db.prepare('PRAGMA table_info(pedidos)').all().map(({ name }) => name);
  const expected = ['id', 'mesa', 'mesa_id', 'estado', 'total_centavos', 'clave_idempotencia', 'solicitud_hash', 'creado_en', 'en_preparacion_en', 'servido_en', 'cancelado_en'];
  if (columns.length !== expected.length || expected.some((column) => !columns.includes(column))) {
    throw new Error('La migración de idempotencia encontró columnas de pedidos no reconocidas');
  }
  db.transaction(() => {
      db.exec(`CREATE TABLE pedidos_identidad (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mesa TEXT NOT NULL,
        mesa_id INTEGER REFERENCES mesas(id),
        estado TEXT NOT NULL DEFAULT 'recibido' CHECK(estado IN ('recibido', 'en_preparacion', 'servido')),
        total_centavos INTEGER NOT NULL CHECK(total_centavos >= 0),
        clave_idempotencia TEXT NOT NULL,
        solicitud_hash TEXT NOT NULL,
        creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        en_preparacion_en TEXT, servido_en TEXT, cancelado_en TEXT
      );
      INSERT INTO pedidos_identidad (${columns.join(', ')}) SELECT ${columns.join(', ')} FROM pedidos;
      DROP TABLE pedidos;
      ALTER TABLE pedidos_identidad RENAME TO pedidos;`);
      savedIndexes.forEach((sql) => db.exec(sql));
      db.exec(`CREATE UNIQUE INDEX idx_pedidos_mesa_intento ON pedidos(mesa_id, clave_idempotencia) WHERE mesa_id IS NOT NULL;
        CREATE UNIQUE INDEX idx_pedidos_legacy_intento ON pedidos(mesa, clave_idempotencia) WHERE mesa_id IS NULL`);
      if (sequence !== undefined) {
        db.prepare("UPDATE sqlite_sequence SET seq = ? WHERE name = 'pedidos'").run(sequence);
      }
      const after = db.prepare('SELECT * FROM pedidos ORDER BY id').all();
      if (rows.length !== after.length || rows.some((row, index) => columns.some((column) => row[column] !== after[index][column])) || db.pragma('foreign_key_check').length) {
        throw new Error('La migración de idempotencia no conserva pedidos o relaciones');
      }
    })();
}
