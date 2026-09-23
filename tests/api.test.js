import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { login, testApp } from './helpers.js';

describe('AdministraciÃ³n del catÃ¡logo', () => {
  let context;
  beforeEach(() => { context = testApp(); });
  afterEach(() => context.cleanup());

  it('DueÃ±o autenticado administra el catÃ¡logo', async () => {
    const response = await login(context.agent);
    expect(response.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
    expect(response.headers['set-cookie'][0]).toMatch(/SameSite=Lax/i);
    await context.agent.post('/api/admin/categorias').send({ nombre: 'Desayunos' }).expect(201);
  });

  it('Cliente sin sesiÃ³n intenta administrar', async () => {
    await context.request.post('/api/admin/categorias').send({ nombre: 'No autorizado' }).expect(401);
    expect(context.catalogo.categoriasAdmin()).toHaveLength(0);
  });

  it('permite editar categorÃ­as y platos con validaciÃ³n', async () => {
    await login(context.agent);
    const cat = (await context.agent.post('/api/admin/categorias').send({ nombre: 'CafÃ©' })).body;
    await context.agent.patch(`/api/admin/categorias/${cat.id}`).send({ nombre: 'Bebidas calientes' }).expect(200);
    const dish = (await context.agent.post('/api/admin/platos').send({ categoriaId: cat.id, nombre: 'Latte', descripcion: 'CafÃ© con leche', precioCentavos: 6500 })).body;
    await context.agent.patch(`/api/admin/platos/${dish.id}`).send({ nombre: 'Latte grande', precioCentavos: 7000 }).expect(200);
    expect(context.catalogo.plato(dish.id)).toMatchObject({ nombre: 'Latte grande', precio_centavos: 7000 });
  });

  it('DueÃ±o reordena categorÃ­as', async () => {
    await login(context.agent);
    const one = (await context.agent.post('/api/admin/categorias').send({ nombre: 'Uno' })).body;
    const two = (await context.agent.post('/api/admin/categorias').send({ nombre: 'Dos' })).body;
    await context.agent.put('/api/admin/categorias/orden').send({ ids: [two.id, one.id] }).expect(200);
    expect(context.catalogo.categoriasAdmin().map((item) => item.nombre)).toEqual(['Dos', 'Uno']);
  });

  it('DueÃ±o crea un plato sin alÃ©rgenos declarados', async () => {
    await login(context.agent);
    const cat = (await context.agent.post('/api/admin/categorias').send({ nombre: 'CafÃ©' })).body;
    const dish = (await context.agent.post('/api/admin/platos').send({ categoriaId: cat.id, nombre: 'Latte', descripcion: 'CafÃ© con leche vegetal', precioCentavos: 6500, alergenos: [] }).expect(201)).body;
    expect(dish.alergenos).toEqual([]);
  });

  it('DueÃ±o reordena platos de una categorÃ­a', async () => {
    await login(context.agent);
    const cat = context.catalogo.crearCategoria({ nombre: 'CafÃ©' });
    const one = context.catalogo.crearPlato({ categoriaId: cat.id, nombre: 'Uno', descripcion: 'Primero', precioCentavos: 1000 });
    const two = context.catalogo.crearPlato({ categoriaId: cat.id, nombre: 'Dos', descripcion: 'Segundo', precioCentavos: 2000 });
    await context.agent.put(`/api/admin/categorias/${cat.id}/platos/orden`).send({ ids: [two.id, one.id] }).expect(200);
    expect(context.catalogo.cartaPublica()[0].platos.map((item) => item.nombre)).toEqual(['Dos', 'Uno']);
  });

  it('DueÃ±o carga una fotografÃ­a vÃ¡lida', async () => {
    await login(context.agent);
    const cat = context.catalogo.crearCategoria({ nombre: 'Postres' });
    const dish = context.catalogo.crearPlato({ categoriaId: cat.id, nombre: 'Pastel', descripcion: 'Chocolate', precioCentavos: 8500 });
    const image = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#a06030' } }).webp().toBuffer();
    const response = await context.agent.post(`/api/admin/platos/${dish.id}/foto`)
      .attach('foto', image, { filename: 'pastel.webp', contentType: 'image/webp' }).expect(200);
    expect(response.body.foto_url).toMatch(/^\/media\/plato-/);
  });

  it('DueÃ±o carga una fotografÃ­a demasiado grande', async () => {
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

describe('Carta digital pÃºblica', () => {
  let context;
  beforeEach(() => { context = testApp(); });
  afterEach(() => context.cleanup());

  it('Cliente consulta la carta desde el QR de su mesa', async () => {
    const response = await context.request.get('/api/carta?mesa=opaco-123').expect(200);
    expect(response.body).toEqual({ mesa: 'opaco-123', categorias: [] });
    expect(context.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%pedido%'").all()).toEqual(expect.arrayContaining([{ name: 'pedidos' }, { name: 'pedido_lineas' }]));
  });

  it('Express sirve los estÃ¡ticos compilados y conserva la ruta pÃºblica', async () => {
    const response = await context.request.get('/?mesa=opaco-123').expect(200);
    expect(response.type).toMatch(/html/);
    expect(response.text).toContain('<div id="root"></div>');
  });

  it('Plato archivado no se publica', async () => {
    const cat = context.catalogo.crearCategoria({ nombre: 'CafÃ©' });
    const dish = context.catalogo.crearPlato({ categoriaId: cat.id, nombre: 'Moka', descripcion: 'Chocolate', precioCentavos: 7000 });
    context.catalogo.archivarPlato(dish.id);
    expect((await context.request.get('/api/carta')).body.categorias).toEqual([]);
  });

  it('CategorÃ­a vacÃ­a no se publica', async () => {
    context.catalogo.crearCategoria({ nombre: 'VacÃ­a' });
    expect((await context.request.get('/api/carta')).body.categorias).toEqual([]);
  });
});
