import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export const ALERGENOS = [
  'Cereales con gluten',
  'Crustáceos',
  'Huevo',
  'Pescado',
  'Cacahuates',
  'Soya',
  'Leche',
  'Frutos de cáscara',
  'Apio',
  'Mostaza',
  'Ajonjolí',
  'Dióxido de azufre y sulfitos',
  'Altramuces',
  'Moluscos'
];

export function createDatabase(filename = ':memory:') {
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new Database(filename);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL CHECK(length(trim(nombre)) > 0),
      orden INTEGER NOT NULL DEFAULT 0,
      archivada INTEGER NOT NULL DEFAULT 0 CHECK(archivada IN (0, 1))
    );
    CREATE TABLE IF NOT EXISTS platos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      categoria_id INTEGER NOT NULL REFERENCES categorias(id),
      nombre TEXT NOT NULL CHECK(length(trim(nombre)) > 0),
      descripcion TEXT NOT NULL CHECK(length(trim(descripcion)) > 0),
      precio_centavos INTEGER NOT NULL CHECK(precio_centavos >= 0),
      orden INTEGER NOT NULL DEFAULT 0,
      archivado INTEGER NOT NULL DEFAULT 0 CHECK(archivado IN (0, 1)),
      archivado_por_categoria INTEGER NOT NULL DEFAULT 0 CHECK(archivado_por_categoria IN (0, 1)),
      agotado_temporalmente INTEGER NOT NULL DEFAULT 0 CHECK(agotado_temporalmente IN (0, 1)),
      foto_url TEXT,
      foto_mime TEXT
    );
    CREATE TABLE IF NOT EXISTS alergenos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS plato_alergenos (
      plato_id INTEGER NOT NULL REFERENCES platos(id),
      alergeno_id INTEGER NOT NULL REFERENCES alergenos(id),
      PRIMARY KEY (plato_id, alergeno_id)
    );
    CREATE INDEX IF NOT EXISTS idx_categorias_publicas ON categorias(archivada, orden);
    CREATE INDEX IF NOT EXISTS idx_platos_publicos ON platos(categoria_id, archivado, agotado_temporalmente, orden);
    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mesa TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'recibido' CHECK(estado IN ('recibido', 'en_preparacion', 'servido')),
      total_centavos INTEGER NOT NULL CHECK(total_centavos >= 0),
      clave_idempotencia TEXT NOT NULL,
      solicitud_hash TEXT NOT NULL,
      creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      en_preparacion_en TEXT,
      servido_en TEXT,
      cancelado_en TEXT,
      UNIQUE(mesa, clave_idempotencia)
    );
    CREATE TABLE IF NOT EXISTS pedido_lineas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
      plato_id INTEGER NOT NULL REFERENCES platos(id),
      nombre_plato TEXT NOT NULL,
      cantidad INTEGER NOT NULL CHECK(cantidad BETWEEN 1 AND 20),
      nota TEXT CHECK(nota IS NULL OR length(nota) <= 140),
      precio_unitario_centavos INTEGER NOT NULL CHECK(precio_unitario_centavos >= 0),
      subtotal_centavos INTEGER NOT NULL CHECK(subtotal_centavos = cantidad * precio_unitario_centavos)
    );
    CREATE INDEX IF NOT EXISTS idx_pedidos_mesa_creado ON pedidos(mesa, creado_en, id);
    CREATE INDEX IF NOT EXISTS idx_pedido_lineas_pedido ON pedido_lineas(pedido_id, id);
  `);

  migrarPedidos(db);
  const columnasPlatos = db.prepare('PRAGMA table_info(platos)').all().map((column) => column.name);
  if (!columnasPlatos.includes('agotado_temporalmente')) {
    db.exec('ALTER TABLE platos ADD COLUMN agotado_temporalmente INTEGER NOT NULL DEFAULT 0 CHECK(agotado_temporalmente IN (0, 1))');
  }

  const insertar = db.prepare('INSERT OR IGNORE INTO alergenos (nombre) VALUES (?)');
  db.transaction(() => ALERGENOS.forEach((nombre) => insertar.run(nombre)))();
  return db;
}

function migrarPedidos(db) {
  const columnas = db.prepare('PRAGMA table_info(pedidos)').all().map((column) => column.name);
  if (columnas.includes('cancelado_en')) return;
  const indices = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'pedidos' AND sql IS NOT NULL").all();
  const secuencia = db.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'pedidos'").get()?.seq;
  const conteos = () => [
    db.prepare('SELECT count(*) AS n FROM pedidos').get().n,
    db.prepare('SELECT count(*) AS n FROM pedido_lineas').get().n
  ];
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      const antes = conteos();
      db.exec(`CREATE TABLE pedidos_migracion (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mesa TEXT NOT NULL,
        ${columnas.includes('mesa_id') ? 'mesa_id INTEGER REFERENCES mesas(id),' : ''}
        estado TEXT NOT NULL DEFAULT 'recibido' CHECK(estado IN ('recibido', 'en_preparacion', 'servido')),
        total_centavos INTEGER NOT NULL CHECK(total_centavos >= 0),
        clave_idempotencia TEXT NOT NULL,
        solicitud_hash TEXT NOT NULL,
        creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        en_preparacion_en TEXT, servido_en TEXT, cancelado_en TEXT,
        UNIQUE(mesa, clave_idempotencia)
      );
      INSERT INTO pedidos_migracion (${columnas.join(', ')}) SELECT ${columnas.join(', ')} FROM pedidos;
      DROP TABLE pedidos;
      ALTER TABLE pedidos_migracion RENAME TO pedidos;`);
      indices.forEach(({ sql }) => db.exec(sql));
      if (secuencia !== undefined) db.prepare("UPDATE sqlite_sequence SET seq = ? WHERE name = 'pedidos'").run(secuencia);
      if (conteos().some((n, i) => n !== antes[i]) || db.pragma('foreign_key_check').length) {
        throw new Error('La migración de pedidos no conserva la integridad de los datos');
      }
    })();
  } finally {
    db.pragma('foreign_keys = ON');
  }
}
