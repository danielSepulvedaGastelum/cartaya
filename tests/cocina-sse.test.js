import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { testApp, login } from './helpers.js';
import { preparar } from './cocina-helpers.js';
import { abrirEventos } from '../src/server/cocina.js';
import { createAuth } from '../src/server/auth.js';

describe('Cocina: SSE', () => {
  let c, nuevo, datos, server, base, cookie, conexiones;
  beforeEach(async () => {
    c = testApp(); ({ nuevo, datos } = preparar(c)); conexiones = [];
    cookie = (await login(c.agent)).headers['set-cookie'][0].split(';')[0];
    server = c.app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = 'http://127.0.0.1:' + server.address().port;
  });
  afterEach(async () => {
    for (const conexion of conexiones) await conexion.cerrar();
    server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); c.cleanup();
  });
  async function conectar() {
    const controller = new AbortController();
    const response = await fetch(base + '/api/cocina/eventos', { headers: { Cookie: cookie }, signal: controller.signal });
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(response.headers.get('cache-control')).toBe('no-cache');
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '', cerrada = false;
    const conexion = {
      async siguiente() {
        while (!buffer.includes('\n\n')) {
          const { value, done } = await reader.read();
          if (done) throw Error('El stream terminó antes del evento'); buffer += decoder.decode(value, { stream: true });
        }
        const fin = buffer.indexOf('\n\n'); const frame = buffer.slice(0, fin); buffer = buffer.slice(fin + 2);
        if (frame.startsWith(':')) return this.siguiente();
        const [evento, data] = frame.split('\n');
        return { tipo: evento.slice(7), data: JSON.parse(data.slice(6)) };
      },
      async cerrar() { if (cerrada) return; cerrada = true; await reader.cancel(); controller.abort(); }
    };
    conexiones.push(conexion); return conexion;
  }
  function colecciones(data) {
    expect(Object.keys(data)).toEqual(expect.arrayContaining(['recibidos', 'enPreparacion', 'servidos', 'cancelados']));
    const numeros = ['recibidos', 'enPreparacion', 'servidos', 'cancelados'].flatMap((k) => data[k].map((p) => p.numero));
    expect(new Set(numeros).size).toBe(numeros.length);
    for (const [key, campo, signo] of [['recibidos', 'creadoEn', 1], ['enPreparacion', 'creadoEn', 1], ['servidos', 'servidoEn', -1], ['cancelados', 'canceladoEn', -1]]) {
      expect(data[key]).toEqual([...data[key]].sort((a, b) => signo * (a[campo].localeCompare(b[campo]) || a.numero - b.numero)));
    }
  }
  it('Pedido confirmado aparece solo', async () => {
    const stream = await conectar(); expect(await stream.siguiente()).toMatchObject({ tipo: 'snapshot', data: { recibidos: [] } });
    const response = await c.request.post('/api/pedidos').send(datos()).expect(201);
    const evento = await stream.siguiente(); expect(evento.tipo).toBe('pedido_nuevo');
    expect(evento.data.recibidos[0].numero).toBe(response.body.numero); colecciones(evento.data);
  });
  it('Cambio de pedido se refleja en otros paneles', async () => {
    const a = nuevo(), b = nuevo(); const uno = await conectar(), dos = await conectar();
    await uno.siguiente(); await dos.siguiente();
    for (const [numero, accion, columna] of [[a.numero, 'iniciar', 'enPreparacion'], [a.numero, 'servir', 'servidos'], [b.numero, 'cancelar', 'cancelados']]) {
      await c.agent.post('/api/cocina/pedidos/' + numero + '/' + accion).expect(200);
      const eventos = await Promise.all([uno.siguiente(), dos.siguiente()]); expect(eventos[0]).toEqual(eventos[1]);
      expect(eventos[0].tipo).toBe('pedidos_actualizados');
      expect(eventos[0].data[columna].map((p) => p.numero)).toContain(numero); colecciones(eventos[0].data);
    }
  });
  it('logout cierra dos canales propios y conserva otra sesion', async () => {
    const primero = await conectar(); const segundo = await conectar();
    await primero.siguiente(); await segundo.siguiente();
    const cookieOriginal = cookie;
    cookie = (await c.request.post('/api/sesion').send({ password: 'cafetera-segura' }).expect(200)).headers['set-cookie'][0].split(';')[0];
    const tercero = await conectar(); await tercero.siguiente();
    await fetch(base + '/api/sesion', { method: 'DELETE', headers: { Cookie: cookieOriginal } });
    const cerraron = await Promise.race([
      Promise.all([primero.siguiente(), segundo.siguiente()].map((p) => p.then(() => false, () => true))),
      new Promise((resolve) => setTimeout(() => resolve([false, false]), 1500))
    ]);
    expect(cerraron).toEqual([true, true]);
    await c.request.post('/api/pedidos').send(datos()).expect(201);
    expect((await tercero.siguiente()).tipo).toBe('pedido_nuevo');
  });
  it('Panel se recupera de una desconexión', async () => {
    const a = nuevo(), b = nuevo(); const stream = await conectar(); await stream.siguiente(); await stream.cerrar();
    c.pedidos.iniciar(a.numero); c.pedidos.servir(a.numero); c.pedidos.cancelar(b.numero);
    nuevo(); c.pedidos.iniciar(nuevo().numero); nuevo(); c.pedidos.cancelar(nuevo().numero);
    const reconexion = await conectar(); const evento = await reconexion.siguiente();
    expect(evento.tipo).toBe('snapshot'); expect(evento.data).toEqual(c.pedidos.instantanea()); colecciones(evento.data);
  });
});

it('El stream mantiene la conexión y limpia suscriptores y temporizadores al cerrar o vencer', () => {
  vi.useFakeTimers();
  try {
    for (const expirar of [false, true]) {
      const res = new EventEmitter(); res.set = vi.fn(); res.flushHeaders = vi.fn(); res.write = vi.fn();
      res.end = vi.fn(() => res.emit('close'));
      const cancelar = vi.fn(); const pedidos = { suscribir: vi.fn(() => cancelar), instantanea: () => ({ recibidos: [] }) };
      abrirEventos({ sesionExpiraEn: Date.now() + 30000 }, res, pedidos);
      expect(res.write).toHaveBeenCalledWith('event: snapshot\ndata: {"recibidos":[]}\n\n');
      vi.advanceTimersByTime(25000); expect(res.write).toHaveBeenCalledWith(': mantenimiento\n\n');
      if (expirar) { vi.advanceTimersByTime(5000); expect(res.end).toHaveBeenCalledOnce(); } else res.emit('close');
      expect(cancelar).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0); expect(res.listenerCount('close')).toBe(0);
    }
  } finally { vi.useRealTimers(); }
});


it('logout ejecuta todos los callbacks aunque uno falle', () => {
  const auth = createAuth({ password: 'clave', production: false });
  let token;
  const loginRes = { cookie: (_name, value) => { token = value; }, json: () => {} };
  auth.login({ body: { password: 'clave' } }, loginRes);
  const req = { headers: { cookie: `cartaya_sesion=${token}` } };
  auth.requireAdmin(req, { status: () => ({ json: () => {} }) }, () => {});
  const ultimo = vi.fn();
  req.suscribirRevocacion(() => { throw new Error('fallo de canal'); });
  req.suscribirRevocacion(ultimo);
  const res = { clearCookie: vi.fn(), status: () => ({ end: vi.fn() }) };
  auth.logout(req, res);
  expect(ultimo).toHaveBeenCalledOnce();
  const denegado = vi.fn();
  auth.requireAdmin(req, { status: () => ({ json: denegado }) }, () => {});
  expect(denegado).toHaveBeenCalledWith({ error: 'Se requiere iniciar sesi\u00f3n' });
});
