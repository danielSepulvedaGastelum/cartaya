import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { testApp, login } from './helpers.js';
import { fechaSql, jornadaLocal } from '../src/server/jornada.js';

import { preparar } from './cocina-helpers.js';

describe('Cocina: consultas, reglas y sesión', () => {
  let c, nuevo, datos;
  beforeEach(() => { c = testApp(); ({ nuevo, datos } = preparar(c)); });
  afterEach(() => { vi.restoreAllMocks(); c.cleanup(); });
  const ids = (lista) => lista.map((p) => p.numero);
  const fila = (id) => c.db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id);

  it('Cocina consulta pedidos activos ordenados', () => {
    const a = nuevo(), b = nuevo(), d = nuevo();
    c.db.prepare("UPDATE pedidos SET creado_en = '2020-01-01 10:00:00' WHERE id IN (?, ?)").run(b.numero, d.numero);
    expect(ids(c.pedidos.instantanea().recibidos)).toEqual([b.numero, d.numero, a.numero]);
    expect(c.pedidos.instantanea().recibidos[0]).toMatchObject({ mesa: 'dos', estado: 'recibido', creadoEn: '2020-01-01T10:00:00Z',
      lineas: [expect.objectContaining({ nombre: 'Torta', cantidad: 2, nota: 'Sin cebolla' })] });
  });
  it('Pedido pendiente de otro día permanece en la cola', () => {
    const a = nuevo(), b = nuevo(); c.pedidos.iniciar(b.numero);
    c.db.prepare("UPDATE pedidos SET creado_en = '2020-01-01 00:00:00'").run();
    const vista = c.pedidos.instantanea(new Date(2030, 0, 2));
    expect(ids(vista.recibidos)).toEqual([a.numero]); expect(ids(vista.enPreparacion)).toEqual([b.numero]);
  });
  it('Cocina consulta el histórico del día', () => {
    const { inicio, fin } = jornadaLocal(new Date(2026, 8, 23, 12));
    const inicioSql = fechaSql(inicio), finSql = fechaSql(fin);
    const anteriores = fechaSql(new Date(inicio.getTime() - 1000));
    const servidos = [nuevo(), nuevo(), nuevo(), nuevo()];
    const cancelados = [nuevo(), nuevo(), nuevo(), nuevo()];
    servidos.forEach((p, i) => c.db.prepare("UPDATE pedidos SET estado = 'servido', servido_en = ? WHERE id = ?").run([anteriores, inicioSql, inicioSql, finSql][i], p.numero));
    cancelados.forEach((p, i) => c.db.prepare('UPDATE pedidos SET cancelado_en = ? WHERE id = ?').run([anteriores, inicioSql, inicioSql, finSql][i], p.numero));
    const vista = c.pedidos.instantanea(new Date(2026, 8, 23, 12));
    expect(ids(vista.servidos)).toEqual([servidos[2].numero, servidos[1].numero]);
    expect(ids(vista.cancelados)).toEqual([cancelados[2].numero, cancelados[1].numero]);
    expect(vista.recibidos).toEqual([]); expect(vista.enPreparacion).toEqual([]);
  });
  it('Pedido anterior termina durante la jornada actual', () => {
    const a = nuevo(), b = nuevo();
    c.db.prepare("UPDATE pedidos SET creado_en = '2020-01-01 00:00:00'").run();
    c.pedidos.iniciar(a.numero); c.pedidos.servir(a.numero); c.pedidos.cancelar(b.numero);
    const vista = c.pedidos.instantanea();
    expect(vista.servidos[0]).toMatchObject({ numero: a.numero, creadoEn: '2020-01-01T00:00:00Z' });
    expect(vista.cancelados[0].numero).toBe(b.numero);
  });
  it('Pedido activo no aparece en el histórico', () => {
    nuevo(); c.pedidos.iniciar(nuevo().numero);
    expect(c.pedidos.instantanea()).toMatchObject({ servidos: [], cancelados: [] });
  });
  it('Cocina comienza un pedido recibido', async () => {
    await login(c.agent); const p = nuevo();
    const r = await c.agent.post('/api/cocina/pedidos/' + p.numero + '/iniciar').expect(200);
    expect(r.body).toMatchObject({ estado: 'en_preparacion', enPreparacionEn: expect.any(String), servidoEn: null });
    expect(ids(c.pedidos.instantanea().enPreparacion)).toEqual([p.numero]);
  });
  it('Cocina sirve un pedido en preparación', async () => {
    await login(c.agent); const p = nuevo(); c.pedidos.iniciar(p.numero);
    const r = await c.agent.post('/api/cocina/pedidos/' + p.numero + '/servir').expect(200);
    expect(r.body).toMatchObject({ estado: 'servido', servidoEn: expect.any(String), lineas: p.lineas });
    expect(c.pedidos.instantanea().enPreparacion).toEqual([]);
    expect(ids(c.pedidos.instantanea().servidos)).toEqual([p.numero]);
  });
  it('Cocina intenta una transición inválida', async () => {
    await login(c.agent); const p = nuevo(); const antes = fila(p.numero);
    await c.agent.post('/api/cocina/pedidos/' + p.numero + '/servir').expect(409);
    expect(fila(p.numero)).toEqual(antes);
    c.pedidos.iniciar(p.numero); const iniciado = fila(p.numero);
    expect(() => c.pedidos.iniciar(p.numero)).toThrow(); expect(fila(p.numero)).toEqual(iniciado);
    c.pedidos.servir(p.numero); const servido = fila(p.numero);
    expect(() => c.pedidos.iniciar(p.numero)).toThrow(); expect(() => c.pedidos.servir(p.numero)).toThrow();
    expect(fila(p.numero)).toEqual(servido);
    const cancelado = nuevo(); c.pedidos.cancelar(cancelado.numero); const antesCancelado = fila(cancelado.numero);
    expect(() => c.pedidos.iniciar(cancelado.numero)).toThrow(); expect(() => c.pedidos.servir(cancelado.numero)).toThrow();
    expect(fila(cancelado.numero)).toEqual(antesCancelado);
    for (const accion of ['iniciar', 'servir', 'cancelar']) await c.agent.post('/api/cocina/pedidos/999/' + accion).expect(404);
  });
  it('Dos pantallas avanzan el mismo pedido', async () => {
    await login(c.agent); const p = nuevo();
    for (const accion of ['iniciar', 'servir']) {
      const url = '/api/cocina/pedidos/' + p.numero + '/' + accion;
      const respuestas = await Promise.all([c.agent.post(url), c.agent.post(url)]);
      expect(respuestas.map((r) => r.status).sort()).toEqual([200, 409]);
    }
  });
  it('Cocina cancela un pedido recibido', async () => {
    await login(c.agent); const p = nuevo();
    const r = await c.agent.post('/api/cocina/pedidos/' + p.numero + '/cancelar').send({ motivo: 'No debe guardarse' }).expect(200);
    expect(r.body).toMatchObject({ estado: 'recibido', canceladoEn: expect.any(String), lineas: p.lineas });
    expect(fila(p.numero)).not.toHaveProperty('motivo'); expect(c.pedidos.instantanea().recibidos).toEqual([]);
    expect(ids(c.pedidos.instantanea().cancelados)).toEqual([p.numero]);
  });
  it('Cocina intenta cancelar después de iniciar la preparación', () => {
    const p = nuevo(); c.pedidos.iniciar(p.numero); const antes = fila(p.numero);
    expect(() => c.pedidos.cancelar(p.numero)).toThrow('ya no puede cancelarse'); expect(fila(p.numero)).toEqual(antes);
    c.pedidos.servir(p.numero); const servido = fila(p.numero);
    expect(() => c.pedidos.cancelar(p.numero)).toThrow(); expect(fila(p.numero)).toEqual(servido);
  });
  it('Cocina intenta cancelar otra vez', () => {
    const p = nuevo(); c.pedidos.cancelar(p.numero); const antes = fila(p.numero);
    expect(() => c.pedidos.cancelar(p.numero)).toThrow(); expect(fila(p.numero)).toEqual(antes);
  });
  it('Sesión del establecimiento abre el panel', async () => {
    await login(c.agent); await c.agent.get('/api/admin/catalogo').expect(200);
    await c.agent.get('/api/cocina').expect(200);
  });
  it('Persona sin sesión intenta consultar el panel', async () => {
    nuevo();
    for (const url of ['/api/cocina', '/api/cocina/eventos']) {
      const r = await c.request.get(url).expect(401); expect(r.body).toEqual({ error: 'Se requiere iniciar sesión' });
    }
    for (const accion of ['iniciar', 'servir', 'cancelar']) await c.request.post('/api/cocina/pedidos/1/' + accion).expect(401);
  });
  it('Sesión cubre la jornada completa', async () => {
    const ahora = new Date(2026, 8, 23, 8).getTime();
    const reloj = vi.spyOn(Date, 'now').mockReturnValue(ahora);
    // jornadaLocal usa new Date: fijamos sólo Date, sin intervenir en el servidor HTTP.
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(ahora);
    try {
      const acceso = await login(c.agent); const cookie = acceso.headers['set-cookie'][0].split(';')[0];
      const fin = jornadaLocal(new Date(ahora)).fin.getTime();
      expect(acceso.body.sesionExpiraEn).toBe(new Date(fin).toISOString());
      expect(acceso.headers['set-cookie'][0]).toContain('Expires=' + new Date(fin).toUTCString());
      vi.setSystemTime(fin - 1); await c.request.get('/api/cocina').set('Cookie', cookie).expect(200);
      vi.setSystemTime(fin); await c.request.get('/api/cocina').set('Cookie', cookie).expect(401);
      await c.request.get('/api/admin/catalogo').set('Cookie', cookie).expect(401);
      await c.request.get('/api/cocina/eventos').set('Cookie', cookie).expect(401);
    } finally { vi.useRealTimers(); reloj.mockRestore(); }
  });
  it('Notifica sólo escrituras confirmadas y retira suscriptores', () => {
    const eventos = []; const salir = c.pedidos.suscribir((evento) => {
      expect(c.db.inTransaction).toBe(false); eventos.push(evento);
    });
    const input = datos(); const p = c.pedidos.confirmar(input).pedido;
    c.pedidos.confirmar(input); expect(eventos.map((e) => e.tipo)).toEqual(['pedido_nuevo']);
    expect(() => c.pedidos.servir(p.numero)).toThrow(); expect(eventos).toHaveLength(1);
    c.pedidos.iniciar(p.numero); c.pedidos.servir(p.numero); c.pedidos.cancelar(nuevo().numero);
    expect(eventos.map((e) => e.tipo)).toEqual(['pedido_nuevo', 'pedidos_actualizados', 'pedidos_actualizados', 'pedido_nuevo', 'pedidos_actualizados']);
    salir(); nuevo(); expect(eventos).toHaveLength(5);
  });
});
