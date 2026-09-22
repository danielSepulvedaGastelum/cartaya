import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { createDatabase } from './database.js';
import { createCatalogo } from './catalogo.js';
import { createAuth } from './auth.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function createApp(config) {
  const db = createDatabase(config.databasePath);
  const catalogo = createCatalogo(db);
  const auth = createAuth(config);
  fs.mkdirSync(config.mediaDir, { recursive: true });

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '128kb' }));
  app.use('/media', express.static(config.mediaDir, { immutable: true, maxAge: '1y' }));

  app.post('/api/sesion', auth.login);
  app.delete('/api/sesion', auth.logout);

  app.get('/api/carta', (req, res) => {
    const mesa = typeof req.query.mesa === 'string' ? req.query.mesa : '';
    res.json({ mesa, categorias: catalogo.cartaPublica() });
  });

  const admin = express.Router();
  admin.use(auth.requireAdmin);
  admin.get('/catalogo', (_req, res) => res.json({
    categorias: catalogo.categoriasAdmin(),
    platos: catalogo.platosAdmin(),
    alergenos: catalogo.listarAlergenos()
  }));
  admin.post('/categorias', (req, res) => res.status(201).json(catalogo.crearCategoria(req.body)));
  admin.put('/categorias/orden', (req, res) => res.json(catalogo.reordenarCategorias(req.body.ids || [])));
  admin.patch('/categorias/:id', (req, res) => respondFound(res, catalogo.editarCategoria(req.params.id, req.body)));
  admin.post('/categorias/:id/archivar', (req, res) => respondFound(res, catalogo.archivarCategoria(req.params.id)));
  admin.post('/categorias/:id/restaurar', (req, res) => respondFound(res, catalogo.restaurarCategoria(req.params.id)));

  admin.post('/platos', (req, res) => res.status(201).json(catalogo.crearPlato(req.body)));
  admin.put('/categorias/:id/platos/orden', (req, res) => res.json(catalogo.reordenarPlatos(req.params.id, req.body.ids || [])));
  admin.patch('/platos/:id', (req, res) => respondFound(res, catalogo.editarPlato(req.params.id, req.body)));
  admin.post('/platos/:id/archivar', (req, res) => respondFound(res, catalogo.archivarPlato(req.params.id)));
  admin.post('/platos/:id/restaurar', (req, res) => respondFound(res, catalogo.restaurarPlato(req.params.id)));

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_BYTES },
    fileFilter: (_req, file, callback) => {
      callback(IMAGE_TYPES.has(file.mimetype) ? null : new Error('Sólo se aceptan imágenes JPEG, PNG o WebP'), IMAGE_TYPES.has(file.mimetype));
    }
  });
  admin.post('/platos/:id/foto', upload.single('foto'), asyncRoute(async (req, res) => {
    if (!catalogo.plato(req.params.id)) return res.status(404).json({ error: 'Plato no encontrado' });
    if (!req.file) return res.status(400).json({ error: 'Selecciona una fotografía' });
    const filename = `plato-${req.params.id}-${Date.now()}.webp`;
    await sharp(req.file.buffer)
      .rotate()
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(path.join(config.mediaDir, filename));
    res.json(catalogo.asignarFoto(req.params.id, `/media/${filename}`));
  }));
  app.use('/api/admin', admin);

  const dist = path.resolve(process.cwd(), 'dist');
  app.use(express.static(dist));
  app.get(/^(?!\/api|\/media).*/, (req, res, next) => {
    const index = path.join(dist, 'index.html');
    if (fs.existsSync(index)) return res.sendFile(index);
    next();
  });

  app.use((error, _req, res, _next) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'La fotografía no puede superar 5 MB' });
    }
    const status = /obligatorio|entero|negativo|no existe|Restaura/.test(error.message) ? 400 : 500;
    res.status(status).json({ error: error.message || 'Error inesperado' });
  });

  return { app, db, catalogo };
}

function respondFound(res, value) {
  return value ? res.json(value) : res.status(404).json({ error: 'Recurso no encontrado' });
}
