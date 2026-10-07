import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { login, testApp } from './helpers.js';

describe('Administración del catálogo', () => {
  let context;
  beforeEach(() => { context = testApp(); });
  afterEach(() => context.cleanup());

  it('Dueño autenticado administra el catálogo', async () => {
    const response = await login(context.agent);
    expect(response.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
    expect(response.headers['set-cookie'][0]).toMatch(/SameSite=Lax/i);
    await context.agent.post('/api/admin/categorias').send({ nombre: 'Desayunos' }).expect(201);
  });

  it('Cliente sin sesión intenta administrar', async () => {
    await context.request.post('/api/admin/categorias').send({ nombre: 'No autorizado' }).expect(401);
    expect(context.catalogo.categoriasAdmin()).toHaveLength(0);
  });

  it('permite editar categorías y platos con validación', async () => {
    await login(context.agent);
    const cat = (await context.agent.post('/api/admin/categorias').send({ nombre: 'Café' })).body;
    await context.agent.patch(`/api/admin/categorias/${cat.id}`).send({ nombre: 'Bebidas calientes' }).expect(200);
    const dish = (await context.agent.post('/api/admin/platos').send({ categoriaId: cat.id, nombre: 'Latte', descripcion: 'Café con leche', precioCentavos: 6500 })).body;
    await context.agent.patch(`/api/admin/platos/${dish.id}`).send({ nombre: 'Latte grande', precioCentavos: 7000 }).expect(200);
    expect(context.catalogo.plato(dish.id)).toMatchObject({ nombre: 'Latte grande', precio_centavos: 7000 });
  });

  it('Dueño reordena categorías', async () => {
    await login(context.agent);
    const one = (await context.agent.post('/api/admin/categorias').send({ nombre: 'Uno' })).body;
    const two = (await context.agent.post('/api/admin/categorias').send({ nombre: 'Dos' })).body;
    await context.agent.put('/api/admin/categorias/orden').send({ ids: [two.id, one.id] }).expect(200);
    expect(context.catalogo.categoriasAdmin().map((item) => item.nombre)).toEqual(['Dos', 'Uno']);
  });

  it('Dueño crea un plato sin alérgenos declarados', async () => {
    await login(context.agent);
    const cat = (await context.agent.post('/api/admin/categorias').send({ nombre: 'Café' })).body;
    const dish = (await context.agent.post('/api/admin/platos').send({ categoriaId: cat.id, nombre: 'Latte', descripcion: 'Café con leche vegetal', precioCentavos: 6500, alergenos: [] }).expect(201)).body;
    expect(dish.alergenos).toEqual([]);
  });

  it('Dueño reordena platos de una categoría', async () => {
    await login(context.agent);
    const cat = context.catalogo.crearCategoria({ nombre: 'Café' });
    const one = context.catalogo.crearPlato({ categoriaId: cat.id, nombre: 'Uno', descripcion: 'Primero', precioCentavos: 1000 });
    const two = context.catalogo.crearPlato({ categoriaId: cat.id, nombre: 'Dos', descripcion: 'Segundo', precioCentavos: 2000 });
    await context.agent.put(`/api/admin/categorias/${cat.id}/platos/orden`).send({ ids: [two.id, one.id] }).expect(200);
    expect(context.catalogo.cartaPublica()[0].platos.map((item) => item.nombre)).toEqual(['Dos', 'Uno']);
  });

  it('Dueño carga una fotografía válida', async () => {
    await login(context.agent);
    const cat = context.catalogo.crearCategoria({ nombre: 'Postres' });
    const dish = context.catalogo.crearPlato({ categoriaId: cat.id, nombre: 'Pastel', descripcion: 'Chocolate', precioCentavos: 8500 });
    const image = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#a06030' } }).webp().toBuffer();
    const response = await context.agent.post(`/api/admin/platos/${dish.id}/foto`)
      .attach('foto', image, { filename: 'pastel.webp', contentType: 'image/webp' }).expect(200);
    expect(response.body.foto_url).toMatch(/^\/media\/plato-/);
  });

  it('Dueño carga una fotografía demasiado grande', async () => {
    await login(context.agent);
    const cat = context.catalogo.crearCategoria({ nombre: 'Postres' });
    const dish = context.catalogo.crearPlato({ categoriaId: cat.id, nombre: 'Pastel', descripcion: 'Chocolate', precioCentavos: 8500 });
    context.catalogo.asignarFoto(dish.id, '/media/anterior.webp');
    const response = await context.agent.post(`/api/admin/platos/${dish.id}/foto`)
      .attach('foto', Buffer.alloc(5 * 1024 * 1024 + 1), { filename: 'grande.png', contentType: 'image/png' }).expect(413);
    expect(response.body.error).toMatch(/5 MB/);
    expect(context.catalogo.plato(dish.id).foto_url).toBe('/media/anterior.webp');
  });
});

describe('Carta digital pública', () => {
  let context;
  beforeEach(() => { context = testApp(); });
  afterEach(() => context.cleanup());

  it('Cliente consulta la carta desde el QR de su mesa', async () => {
    const response = await context.request.get('/api/carta?mesa=opaco-123').expect(200);
    expect(response.body).toEqual({ mesa: 'opaco-123', categorias: [] });
    expect(context.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%pedido%'").all()).toEqual(expect.arrayContaining([{ name: 'pedidos' }, { name: 'pedido_lineas' }]));
  });

  it('Express sirve los estáticos compilados y conserva la ruta pública', async () => {
    const response = await context.request.get('/?mesa=opaco-123').expect(200);
    expect(response.type).toMatch(/html/);
    expect(response.text).toContain('<div id="root"></div>');
  });

  it('Plato archivado no se publica', async () => {
    const cat = context.catalogo.crearCategoria({ nombre: 'Café' });
    const dish = context.catalogo.crearPlato({ categoriaId: cat.id, nombre: 'Moka', descripcion: 'Chocolate', precioCentavos: 7000 });
    context.catalogo.archivarPlato(dish.id);
    expect((await context.request.get('/api/carta')).body.categorias).toEqual([]);
  });

  it('Categoría vacía no se publica', async () => {
    context.catalogo.crearCategoria({ nombre: 'Vacía' });
    expect((await context.request.get('/api/carta')).body.categorias).toEqual([]);
  });
});
