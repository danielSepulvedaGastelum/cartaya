import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { testApp } from './helpers.js';
import { createDatabase } from '../src/server/database.js';
import { createMesas } from '../src/server/mesas.js';
import { login } from './helpers.js';
import { mesaToken } from '../src/server/generate-qr.js';

const config = { mesas: ['uno'], sessionSecret: 'secreto-de-pruebas-largo', publicBaseUrl: 'http://localhost:3000' };

describe('Drift de pedidos en la API', () => {
  let c, plato, token;
  beforeEach(() => {
    c = testApp();
    token = mesaToken('uno', config.sessionSecret);
    const categoria = c.catalogo.crearCategoria({ nombre: 'Comida' });
    plato = c.catalogo.crearPlato({ categoriaId: categoria.id, nombre: 'Torta', descripcion: 'Pan', precioCentavos: 4500 });
  });
  afterEach(() => c.cleanup());
  const linea = (platoId, lineaId, precioCentavos = 4500) => ({ lineaId, platoId, cantidad: 1, nota: null, precioCentavos });
  const intento = (mesa, lineas) => ({ mesa, claveIdempotencia: 'misma-clave', lineas });

  it('informa retiros y precios nuevos a la vez sin escribir pedidos', async () => {
    const otro = c.catalogo.crearPlato({ categoriaId: c.catalogo.categoriasAdmin()[0].id, nombre: 'Cafe', descripcion: 'Taza', precioCentavos: 3000 });
    c.catalogo.archivarPlato(plato.id);
    c.catalogo.editarPlato(otro.id, { precioCentavos: 3500 });
    const respuesta = await c.request.post('/api/pedidos').send(intento(token, [linea(plato.id, 'a'), linea(otro.id, 'b', 3000), linea(otro.id, 'c', 3000)])).expect(409);
    expect(respuesta.body).toMatchObject({ tipo: 'no_disponible', totalCentavos: 7000 });
    expect(respuesta.body.noDisponibles.map((l) => l.lineaId)).toEqual(['a']);
    expect(respuesta.body.preciosModificados.map((l) => l.lineaId)).toEqual(['b', 'c']);
    expect(respuesta.body.lineas.map((l) => [l.lineaId, l.precioCentavos])).toEqual([['b', 3500], ['c', 3500]]);
    expect(c.db.prepare('SELECT count(*) AS n FROM pedidos').get().n).toBe(0);
  });

  it('reintenta por identidad estable tras renombrar o desactivar sin abrir otro pedido', async () => {
    const original = intento(token, [linea(plato.id, 'a')]);
    const primero = await c.request.post('/api/pedidos').send(original).expect(201);
    const mesa = c.mesas.porToken(token);
    c.mesas.renombrar(mesa.id, { nombre: 'nueva' });
    c.mesas.desactivar(mesa.id);
    expect((await c.request.post('/api/pedidos').send(original).expect(200)).body).toEqual(primero.body);
    await c.request.post('/api/pedidos').send(intento(token, [linea(plato.id, 'b')])).expect(409);
    await c.request.post('/api/pedidos').send({ ...original, claveIdempotencia: 'otra' }).expect(400);
    expect(c.db.prepare('SELECT count(*) AS n FROM pedidos').get().n).toBe(1);
  });

  it('permite reutilizar un nombre de mesa sin acoplar claves historicas', async () => {
    const anterior = await c.request.post('/api/pedidos').send(intento(token, [linea(plato.id, 'a')])).expect(201);
    const mesaVieja = c.mesas.porToken(token);
    c.mesas.renombrar(mesaVieja.id, { nombre: 'renombrada' });
    const nueva = c.mesas.crear({ nombre: 'uno' });
    const actual = await c.request.post('/api/pedidos').send(intento(nueva.token, [linea(plato.id, 'a')])).expect(201);
    expect(actual.body.numero).not.toBe(anterior.body.numero);
    expect(c.db.prepare('SELECT mesa, mesa_id FROM pedidos ORDER BY id').all()).toEqual([
      { mesa: 'uno', mesa_id: mesaVieja.id }, { mesa: 'uno', mesa_id: nueva.id }
    ]);
  });

  it('aisla la misma clave entre mesas y preserva el nombre historico', async () => {
    const primero = await c.request.post('/api/pedidos').send(intento(token, [linea(plato.id, 'a')])).expect(201);
    const tokenDos = mesaToken('dos', config.sessionSecret);
    const segundo = await c.request.post('/api/pedidos').send(intento(tokenDos, [linea(plato.id, 'a')])).expect(201);
    expect(segundo.body.numero).not.toBe(primero.body.numero);
    expect(c.db.prepare('SELECT mesa FROM pedidos WHERE id = ?').get(primero.body.numero).mesa).toBe('uno');
  });
});

describe('Migracion de identidad del intento', () => {
  const insertar = (db, id, mesa, clave = 'clave') => db.prepare('INSERT INTO pedidos (id, mesa, total_centavos, clave_idempotencia, solicitud_hash) VALUES (?, ?, 0, ?, ?)').run(id, mesa, clave, 'hash');
  it('revierte inicializacion completa al detectar colision de nombres heredados', () => {
    const db = createDatabase();
    try {
      insertar(db, 1, 'uno'); insertar(db, 2, 'UNO');
      const antes = db.prepare('SELECT * FROM pedidos ORDER BY id').all();
      expect(() => createMesas(db, config)).toThrow(/duplicados 1,2/);
      expect(db.prepare('SELECT * FROM pedidos ORDER BY id').all()).toEqual(antes);
      expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'mesas'").get()).toBeUndefined();
      expect(db.prepare('PRAGMA table_info(pedidos)').all().some((c) => c.name === 'mesa_id')).toBe(false);
      expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    } finally { db.close(); }
  });

  it('diagnostica referencias invalidas sin modificar la fila', () => {
    const db = createDatabase();
    try {
      createMesas(db, config);
      db.exec('DROP INDEX idx_pedidos_mesa_intento');
      db.pragma('foreign_keys = OFF');
      db.prepare('INSERT INTO pedidos (id, mesa, mesa_id, total_centavos, clave_idempotencia, solicitud_hash) VALUES (8, ?, 999, 0, ?, ?)').run('perdida', 'clave', 'hash');
      db.pragma('foreign_keys = ON');
      const antes = db.prepare('SELECT * FROM pedidos').all();
      expect(() => createMesas(db, config)).toThrow(/referencias 8/);
      expect(db.prepare('SELECT * FROM pedidos').all()).toEqual(antes);
      expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    } finally { db.close(); }
  });

  it('conserva filas sin mesa comprobable y no las asocia al reutilizar nombre', () => {
    const db = createDatabase();
    try {
      insertar(db, 4, 'antigua');
      const mesas = createMesas(db, config);
      expect(db.prepare('SELECT mesa_id FROM pedidos WHERE id = 4').get().mesa_id).toBeNull();
      mesas.crear({ nombre: 'antigua' });
      expect(db.prepare('SELECT mesa_id FROM pedidos WHERE id = 4').get().mesa_id).toBeNull();
      createMesas(db, config);
      expect(db.prepare('SELECT mesa_id FROM pedidos WHERE id = 4').get().mesa_id).toBeNull();
      expect(db.pragma('foreign_key_check')).toEqual([]);
    } finally { db.close(); }
  });
});


describe('Agotamiento temporal independiente', () => {
  let c, categoria, plato, mesa;
  beforeEach(async () => {
    c = testApp(); await login(c.agent);
    categoria = c.catalogo.crearCategoria({ nombre: 'Comida' });
    plato = c.catalogo.crearPlato({ categoriaId: categoria.id, nombre: 'Pan', descripcion: 'Integral', precioCentavos: 1000 });
    mesa = c.mesas.lista()[0].token;
  });
  afterEach(() => c.cleanup());
  const publicar = (c, mesa) => c.request.get(`/api/carta?mesa=${mesa}`);
  it('oculta el agotado, conserva datos e historial, y lo devuelve al publicar', async () => {
    const pedido = { mesa, claveIdempotencia: 'historico', lineas: [{ lineaId: 'a', platoId: plato.id, cantidad: 1, nota: null, precioCentavos: 1000 }] };
    await c.request.post('/api/pedidos').send(pedido).expect(201);
    await c.agent.post(`/api/admin/platos/${plato.id}/agotar`).expect(200);
    expect(c.catalogo.plato(plato.id)).toMatchObject({ nombre: 'Pan', descripcion: 'Integral', precio_centavos: 1000, agotado_temporalmente: 1 });
    expect((await publicar(c, mesa)).body.categorias).toEqual([]);
    await c.request.post('/api/pedidos').send({ ...pedido, claveIdempotencia: 'nuevo' }).expect(409);
    expect(c.db.prepare('SELECT count(*) AS n FROM pedidos').get().n).toBe(1);
    await c.agent.post(`/api/admin/platos/${plato.id}/reactivar`).expect(200);
    expect((await publicar(c, mesa)).body.categorias[0].platos[0].id).toBe(plato.id);
    await c.request.post('/api/pedidos').send({ ...pedido, claveIdempotencia: 'nuevo' }).expect(201);
  });
  it('reactivar no restaura archivos y restaurar no elimina agotamiento', async () => {
    await c.agent.post(`/api/admin/platos/${plato.id}/agotar`).expect(200);
    await c.agent.post(`/api/admin/platos/${plato.id}/archivar`).expect(200);
    await c.agent.post(`/api/admin/platos/${plato.id}/restaurar`).expect(200);
    expect(c.catalogo.plato(plato.id)).toMatchObject({ archivado: 0, agotado_temporalmente: 1 });
    await c.agent.post(`/api/admin/categorias/${categoria.id}/archivar`).expect(200);
    await c.agent.post(`/api/admin/platos/${plato.id}/reactivar`).expect(200);
    expect(c.catalogo.plato(plato.id)).toMatchObject({ agotado_temporalmente: 0, archivado: 1 });
    expect((await publicar(c, mesa)).body.categorias).toEqual([]);
  });
  it('mensajes propios de sesion y fotografias son legibles', async () => {
    const acceso = await c.request.post('/api/sesion').send({ password: 'mala' }).expect(401);
    expect(acceso.body.error).toBe('Contrase\u00f1a incorrecta');
    const foto = await c.agent.post(`/api/admin/platos/${plato.id}/foto`)
      .attach('foto', Buffer.from('texto'), { filename: 'mala.txt', contentType: 'text/plain' }).expect(400);
    expect(foto.body.error).toBe('S\u00f3lo se aceptan im\u00e1genes JPEG, PNG o WebP');
  });
  it('sin sesion no modifica agotamiento', async () => {
    await c.request.post(`/api/admin/platos/${plato.id}/agotar`).expect(401);
    expect(c.catalogo.plato(plato.id).agotado_temporalmente).toBe(0);
    await c.agent.post(`/api/admin/platos/${plato.id}/agotar`).expect(200);
    await c.request.post(`/api/admin/platos/${plato.id}/reactivar`).expect(401);
    expect(c.catalogo.plato(plato.id).agotado_temporalmente).toBe(1);
  });
});
