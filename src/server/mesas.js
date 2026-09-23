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
  if (!columns.includes('mesa_id')) db.exec('ALTER TABLE pedidos ADD COLUMN mesa_id INTEGER REFERENCES mesas(id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_pedidos_mesa_id_creado ON pedidos(mesa_id, creado_en, id)');

  if (db.prepare('SELECT COUNT(*) AS total FROM mesas').get().total === 0) {
    const insert = db.prepare('INSERT OR IGNORE INTO mesas (nombre, token) VALUES (?, ?)');
    db.transaction(() => (config.mesas || []).forEach((nombre) => insert.run(nombre, mesaToken(nombre, config.sessionSecret))))();
  }
  db.prepare(`UPDATE pedidos SET mesa_id = (SELECT id FROM mesas WHERE mesas.nombre = pedidos.mesa COLLATE NOCASE)
    WHERE mesa_id IS NULL`).run();

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
