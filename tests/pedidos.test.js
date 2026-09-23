import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mesaToken } from '../src/server/generate-qr.js';
import { testApp } from './helpers.js';

function payload(token, platoId, overrides = {}) {
  return {
    mesa: token,
    claveIdempotencia: 'intento-uno',
    lineas: [{ lineaId: 'linea-uno', platoId, cantidad: 2, nota: 'sin cebolla', precioCentavos: 4500 }],
    ...overrides
  };
}

describe('Pedidos de mesa', () => {
  let context;
  let token;
  let plato;
  beforeEach(() => {
    context = testApp();
    token = mesaToken('uno', 'secreto-de-pruebas-largo');
    const categoria = context.catalogo.crearCategoria({ nombre: 'Comida' });
    plato = context.catalogo.crearPlato({ categoriaId: categoria.id, nombre: 'Torta', descripcion: 'Pan y relleno', precioCentavos: 4500 });
  });
  afterEach(() => context.cleanup());

  it('Cliente consulta la carta desde el QR de su mesa', async () => {
    const response = await context.request.get(`/api/carta?mesa=${token}`).expect(200);
    expect(response.body.mesaValida).toBe(true);
    expect(response.body.categorias[0].platos[0].nombre).toBe('Torta');
  });

  it('Consulta sin mesa identificada', async () => {
    const response = await context.request.get('/api/carta').expect(200);
    expect(response.body.mesaValida).toBeUndefined();
  });

  it('Plato agotado temporalmente no aparece en la carta', async () => {
    context.catalogo.marcarAgotadoTemporalmente(plato.id);
    expect(context.catalogo.cartaPublica()).toEqual([]);
    context.catalogo.reactivarPlato(plato.id);
    expect(context.catalogo.cartaPublica()[0].platos[0].id).toBe(plato.id);
  });

  it('Cliente revisa y confirma un pedido', async () => {
    const response = await context.request.post('/api/pedidos').send(payload(token, plato.id)).expect(201);
    expect(response.body).toMatchObject({ numero: 1, mesa: 'uno', estado: 'recibido', totalCentavos: 9000 });
    expect(response.body.lineas[0]).toMatchObject({ nombre: 'Torta', cantidad: 2, nota: 'sin cebolla', subtotalCentavos: 9000 });
  });

  it('Cliente intenta confirmar un pedido vacio', async () => {
    await context.request.post('/api/pedidos').send(payload(token, plato.id, { lineas: [] })).expect(400);
    expect(context.db.prepare('SELECT * FROM pedidos').all()).toEqual([]);
  });

  it('Confirmacion muestra numero y estado', async () => {
    const response = await context.request.post('/api/pedidos').send(payload(token, plato.id)).expect(201);
    expect(response.body.numero).toBe(1);
    expect(response.body.estado).toBe('recibido');
  });

  it('Mesa confirma dos pedidos durante el servicio', async () => {
    await context.request.post('/api/pedidos').send(payload(token, plato.id, { claveIdempotencia: 'uno' })).expect(201);
    const segundo = await context.request.post('/api/pedidos').send(payload(token, plato.id, { claveIdempotencia: 'dos', lineas: [{ lineaId: 'dos', platoId: plato.id, cantidad: 1, nota: null, precioCentavos: 4500 }] })).expect(201);
    expect(segundo.body.numero).toBe(2);
    expect(context.db.prepare('SELECT * FROM pedidos WHERE mesa = ?').all('uno')).toHaveLength(2);
  });

  it('Cambio posterior en el catalogo', async () => {
    const pedido = await context.request.post('/api/pedidos').send(payload(token, plato.id)).expect(201);
    context.catalogo.editarPlato(plato.id, { nombre: 'Torta grande', precioCentavos: 6000 });
    expect(pedido.body.lineas[0]).toMatchObject({ nombre: 'Torta', precioUnitarioCentavos: 4500 });
    expect(context.db.prepare('SELECT nombre_plato, precio_unitario_centavos FROM pedido_lineas').get()).toEqual({ nombre_plato: 'Torta', precio_unitario_centavos: 4500 });
  });

  it('Plato archivado antes de confirmar', async () => {
    context.catalogo.archivarPlato(plato.id);
    const response = await context.request.post('/api/pedidos').send(payload(token, plato.id)).expect(409);
    expect(response.body.tipo).toBe('no_disponible');
    expect(context.db.prepare('SELECT * FROM pedidos').all()).toEqual([]);
  });

  it('Plato agotado temporalmente antes de confirmar', async () => {
    context.catalogo.marcarAgotadoTemporalmente(plato.id);
    const response = await context.request.post('/api/pedidos').send(payload(token, plato.id)).expect(409);
    expect(response.body.noDisponibles[0].motivo).toBe('agotado temporalmente');
  });

  it('Precio cambia antes de confirmar', async () => {
    context.catalogo.editarPlato(plato.id, { precioCentavos: 5000 });
    const response = await context.request.post('/api/pedidos').send(payload(token, plato.id)).expect(409);
    expect(response.body).toMatchObject({ tipo: 'precio_modificado', totalCentavos: 10000 });
    expect(context.db.prepare('SELECT * FROM pedidos').all()).toEqual([]);
  });

  it('Todos los platos siguen activos al confirmar', async () => {
    await context.request.post('/api/pedidos').send(payload(token, plato.id)).expect(201);
  });

  it('Doble toque en confirmar', async () => {
    const data = payload(token, plato.id);
    const [uno, dos] = await Promise.all([context.request.post('/api/pedidos').send(data), context.request.post('/api/pedidos').send(data)]);
    expect([uno.status, dos.status].sort()).toEqual([200, 201]);
    expect(context.db.prepare('SELECT * FROM pedidos').all()).toHaveLength(1);
  });

  it('Reintento de red del mismo intento', async () => {
    const data = payload(token, plato.id);
    const primero = await context.request.post('/api/pedidos').send(data).expect(201);
    const reintento = await context.request.post('/api/pedidos').send(data).expect(200);
    expect(reintento.body).toEqual(primero.body);
  });

  it('valida mesa, cantidades, notas y conserva lineas repetidas', async () => {
    await context.request.post('/api/pedidos').send(payload('invalida', plato.id)).expect(400);
    await context.request.post('/api/pedidos').send(payload(token, plato.id, { lineas: [{ platoId: plato.id, cantidad: 21, nota: '', precioCentavos: 4500 }] })).expect(400);
    await context.request.post('/api/pedidos').send(payload(token, plato.id, { lineas: [{ platoId: plato.id, cantidad: 1, nota: 'x'.repeat(141), precioCentavos: 4500 }] })).expect(400);
    const lineas = [
      { lineaId: 'a', platoId: plato.id, cantidad: 1, nota: 'sin cebolla', precioCentavos: 4500 },
      { lineaId: 'b', platoId: plato.id, cantidad: 1, nota: 'muy picante', precioCentavos: 4500 }
    ];
    await context.request.post('/api/pedidos').send(payload(token, plato.id, { lineas })).expect(201);
    expect(context.db.prepare('SELECT nota FROM pedido_lineas ORDER BY id').all()).toEqual([{ nota: 'sin cebolla' }, { nota: 'muy picante' }]);
  });

  it('acepta los limites de cantidad y nota de una linea', async () => {
    const response = await context.request.post('/api/pedidos').send(payload(token, plato.id, {
      lineas: [{ lineaId: 'limite', platoId: plato.id, cantidad: 20, nota: 'x'.repeat(140), precioCentavos: 4500 }]
    })).expect(201);
    expect(response.body.totalCentavos).toBe(90000);
    expect(response.body.lineas[0].nota).toHaveLength(140);
  });
  it('rechaza reutilizar la clave con contenido distinto', async () => {
    await context.request.post('/api/pedidos').send(payload(token, plato.id)).expect(201);
    await context.request.post('/api/pedidos').send(payload(token, plato.id, { lineas: [{ lineaId: 'otro', platoId: plato.id, cantidad: 1, nota: '', precioCentavos: 4500 }] })).expect(409);
  });
});

