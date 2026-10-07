import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import QRCode from 'qrcode';
import { createDatabase } from './database.js';
import { createCatalogo } from './catalogo.js';
import { createAuth } from './auth.js';
import { createPedidos, PedidoError } from './pedidos.js';
import { createMesas } from './mesas.js';
import { createCocina } from './cocina.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function createApp(config) {
  const db = createDatabase(config.databasePath);
  const catalogo = createCatalogo(db);
  const mesas = createMesas(db, config);
  const auth = createAuth(config);
  const pedidos = createPedidos(db, mesas, catalogo);
  fs.mkdirSync(config.mediaDir, { recursive: true });

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '128kb' }));
  app.use('/media', express.static(config.mediaDir, { immutable: true, maxAge: '1y' }));

  app.post('/api/sesion', auth.login);
  app.delete('/api/sesion', auth.logout);

  app.get('/api/carta', (req, res) => {
    const mesa = typeof req.query.mesa === 'string' ? req.query.mesa : '';
    const mesaEncontrada = mesas.porToken(mesa);
    res.json({ mesa, ...(mesaEncontrada?.activa ? { mesaValida: true } : {}), ...(mesaEncontrada && !mesaEncontrada.activa ? { mesaInactiva: true } : {}), categorias: catalogo.cartaPublica() });
  });

  app.post('/api/pedidos', (req, res) => {
    const resultado = pedidos.confirmar(req.body || {});
    if (resultado.tipo === 'confirmado') return res.status(resultado.reintento ? 200 : 201).json(resultado.pedido);
    if (resultado.tipo === 'no_disponible') {
      return res.status(409).json({ error: 'Algunos platos ya no están disponibles', ...resultado });
    }
    return res.status(409).json({ error: 'El precio de algunos platos cambió', ...resultado });
  });

  app.use('/api/cocina', createCocina(auth, pedidos));

  const admin = express.Router();
  admin.use(auth.requireAdmin);
  admin.get('/catalogo', (_req, res) => res.json({
    categorias: catalogo.categoriasAdmin(),
    platos: catalogo.platosAdmin(),
    alergenos: catalogo.listarAlergenos()
  }));
  admin.get('/mesas', (_req, res) => res.json({ mesas: mesas.lista() }));
  admin.post('/mesas', (req, res) => res.status(201).json(mesas.crear(req.body || {})));
  admin.patch('/mesas/:id', (req, res) => respondFound(res, mesas.renombrar(req.params.id, req.body || {})));
  admin.post('/mesas/:id/desactivar', (req, res) => respondFound(res, mesas.desactivar(req.params.id)));
  admin.post('/mesas/:id/reactivar', (req, res) => respondFound(res, mesas.reactivar(req.params.id)));
  admin.get('/mesas/:id/historial', (req, res) => {
    const historial = mesas.historial(req.params.id);
    return historial ? res.json({ pedidos: historial }) : res.status(404).json({ error: 'Mesa no encontrada' });
  });
  admin.get('/mesas/:id/qr', asyncRoute(async (req, res) => {
    const mesa = mesas.porId(req.params.id);
    if (!mesa) return res.status(404).json({ error: 'Mesa no encontrada' });
    const png = await QRCode.toBuffer(mesa.url, { width: 900, margin: 2, errorCorrectionLevel: 'H' });
    res.type('png');
    if (req.query.descargar === '1') res.attachment(`mesa-${mesa.id}.png`);
    return res.send(png);
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
  admin.post('/platos/:id/agotar', (req, res) => respondFound(res, catalogo.marcarAgotadoTemporalmente(req.params.id)));
  admin.post('/platos/:id/reactivar', (req, res) => respondFound(res, catalogo.reactivarPlato(req.params.id)));
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
    if (error instanceof PedidoError) {
      return res.status(error.status).json({ error: error.message, ...error.details });
    }
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'La fotografía no puede superar 5 MB' });
    }
    const status = /obligatorio|entero|negativo|no existe|Restaura|se aceptan im/.test(error.message) ? 400 : 500;
    res.status(status).json({ error: error.message || 'Error inesperado' });
  });

  return { app, db, catalogo, pedidos, mesas };
}

function respondFound(res, value) {
  return value ? res.json(value) : res.status(404).json({ error: 'Recurso no encontrado' });
}
