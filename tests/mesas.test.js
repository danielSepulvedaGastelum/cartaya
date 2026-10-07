import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { login, testApp } from './helpers.js';

describe('Administracion de mesas', () => {
  let context;
  beforeEach(() => { context = testApp(); });
  afterEach(() => context.cleanup());

  it('Dueno crea una mesa, conserva su QR al renombrar y la desactiva', async () => {
    await login(context.agent);
    const creada = await context.agent.post('/api/admin/mesas').send({ nombre: 'Terraza' }).expect(201);
    const token = creada.body.token;
    expect(creada.body.activa).toBe(true);
    const qrAntes = await context.agent.get(`/api/admin/mesas/${creada.body.id}/qr`).expect('Content-Type', /image\/png/).expect(200);
    const renombrada = await context.agent.patch(`/api/admin/mesas/${creada.body.id}`).send({ nombre: 'Terraza norte' }).expect(200);
    expect(renombrada.body.token).toBe(token);
    const qrDespues = await context.agent.get(`/api/admin/mesas/${creada.body.id}/qr`).expect(200);
    expect(qrDespues.body).toEqual(qrAntes.body);
    const descarga = await context.agent.get(`/api/admin/mesas/${creada.body.id}/qr?descargar=1`).expect(200);
    expect(descarga.headers['content-disposition']).toMatch(/attachment.*mesa-/);
    await context.agent.post(`/api/admin/mesas/${creada.body.id}/desactivar`).expect(200);
    const carta = await context.request.get(`/api/carta?mesa=${token}`).expect(200);
    expect(carta.body.mesaInactiva).toBe(true);
    expect((await context.agent.get(`/api/admin/mesas/${creada.body.id}/qr`).expect(200)).body).toEqual(qrAntes.body);
    await context.agent.get(`/api/admin/mesas/${creada.body.id}/qr?descargar=1`).expect(200);
    await context.agent.post(`/api/admin/mesas/${creada.body.id}/reactivar`).expect(200);
    expect((await context.request.get(`/api/carta?mesa=${token}`).expect(200)).body.mesaValida).toBe(true);
  });

  it('Dueno consulta el historial de una mesa inactiva', async () => {
    await login(context.agent);
    const mesa = context.mesas.lista()[0];
    const categoria = await context.agent.post('/api/admin/categorias').send({ nombre: 'Pruebas' }).expect(201);
    const plato = await context.agent.post('/api/admin/platos').send({ nombre: 'Pan', descripcion: 'Pan', categoriaId: categoria.body.id, precioCentavos: 1000 }).expect(201);
    await context.request.post('/api/pedidos').send({ mesa: mesa.token, claveIdempotencia: 'historial', lineas: [{ lineaId: 'uno', platoId: plato.body.id, cantidad: 1, nota: '', precioCentavos: 1000 }] }).expect(201);
    await context.agent.post(`/api/admin/mesas/${mesa.id}/desactivar`).expect(200);
    const historial = await context.agent.get(`/api/admin/mesas/${mesa.id}/historial`).expect(200);
    expect(historial.body.pedidos).toHaveLength(1);
  });
});
