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
    CREATE INDEX IF NOT EXISTS idx_platos_publicos ON platos(categoria_id, archivado, orden);
  `);

  const insertar = db.prepare('INSERT OR IGNORE INTO alergenos (nombre) VALUES (?)');
  db.transaction(() => ALERGENOS.forEach((nombre) => insertar.run(nombre)))();
  return db;
}
