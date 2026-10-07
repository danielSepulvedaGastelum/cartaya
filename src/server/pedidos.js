import crypto from 'node:crypto';
import { fechaSql, jornadaLocal } from './jornada.js';

export class PedidoError extends Error {
  constructor(message, status = 400, details = {}) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function entero(value, campo) {
  if (!Number.isInteger(value)) throw new PedidoError(`${campo} debe ser un entero`);
  return value;
}

function notaValida(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new PedidoError('La nota debe ser texto');
  if (value.length > 140) throw new PedidoError('La nota no puede superar 140 caracteres');
  return value;
}

function solicitudHash(lineas) {
  const canonica = lineas.map(({ lineaId, platoId, cantidad, nota, precioCentavos }) => ({ lineaId, platoId, cantidad, nota, precioCentavos }));
  return crypto.createHash('sha256').update(JSON.stringify(canonica)).digest('hex');
}

function serializarPedido(db, pedidoId) {
  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedidoId);
  const iso = (value) => value ? value.replace(' ', 'T') + 'Z' : null;
  const lineas = db.prepare(`SELECT id, plato_id, nombre_plato, cantidad, nota,
    precio_unitario_centavos, subtotal_centavos FROM pedido_lineas WHERE pedido_id = ? ORDER BY id`).all(pedidoId);
  return {
    numero: pedido.id, mesa: pedido.mesa, estado: pedido.estado, totalCentavos: pedido.total_centavos,
    creadoEn: iso(pedido.creado_en), enPreparacionEn: iso(pedido.en_preparacion_en),
    servidoEn: iso(pedido.servido_en), canceladoEn: iso(pedido.cancelado_en),
    lineas: lineas.map((linea) => ({
      id: linea.id, platoId: linea.plato_id, nombre: linea.nombre_plato, cantidad: linea.cantidad, nota: linea.nota,
      precioUnitarioCentavos: linea.precio_unitario_centavos, subtotalCentavos: linea.subtotal_centavos
    }))
  };
}

export function createPedidos(db, mesas, catalogo) {
  const suscriptores = new Set();

  function instantanea(ahora = new Date()) {
    const { inicio, fin } = jornadaLocal(ahora);
    const activos = db.prepare(`SELECT id, estado FROM pedidos WHERE cancelado_en IS NULL
      AND estado IN ('recibido', 'en_preparacion') ORDER BY creado_en, id`).all();
    const terminados = db.prepare(`SELECT id, cancelado_en FROM pedidos
      WHERE (servido_en >= ? AND servido_en < ?) OR (cancelado_en >= ? AND cancelado_en < ?)
      ORDER BY COALESCE(cancelado_en, servido_en) DESC, id DESC`)
      .all(fechaSql(inicio), fechaSql(fin), fechaSql(inicio), fechaSql(fin));
    const serializar = ({ id }) => serializarPedido(db, id);
    return {
      recibidos: activos.filter((p) => p.estado === 'recibido').map(serializar),
      enPreparacion: activos.filter((p) => p.estado === 'en_preparacion').map(serializar),
      servidos: terminados.filter((p) => !p.cancelado_en).map(serializar),
      cancelados: terminados.filter((p) => p.cancelado_en).map(serializar)
    };
  }

  function publicar(tipo, numero) {
    if (!suscriptores.size) return;
    const evento = { tipo, numero, ...instantanea() };
    for (const suscriptor of suscriptores) {
      // Una desconexión no puede convertir una escritura confirmada en error.
      try { suscriptor(evento); } catch { suscriptores.delete(suscriptor); }
    }
  }

  function suscribir(suscriptor) {
    suscriptores.add(suscriptor);
    return () => suscriptores.delete(suscriptor);
  }

  function cambiar(numero, accion) {
    const acciones = {
      iniciar: ["estado = 'en_preparacion', en_preparacion_en = CURRENT_TIMESTAMP", 'recibido'],
      servir: ["estado = 'servido', servido_en = CURRENT_TIMESTAMP", 'en_preparacion'],
      cancelar: ['cancelado_en = CURRENT_TIMESTAMP', 'recibido']
    };
    const [asignacion, origen] = acciones[accion];
    const result = db.prepare(`UPDATE pedidos SET ${asignacion}
      WHERE id = ? AND estado = ? AND cancelado_en IS NULL`).run(numero, origen);
    if (!result.changes) {
      if (!db.prepare('SELECT id FROM pedidos WHERE id = ?').get(numero)) throw new PedidoError('Pedido no encontrado', 404);
      throw new PedidoError(accion === 'cancelar' ? 'El pedido ya no puede cancelarse' : 'La transición no es válida para el estado actual', 409);
    }
    publicar('pedidos_actualizados', Number(numero));
    return serializarPedido(db, numero);
  }

  function resolverMesa(token) {
    const mesa = mesas.porToken(token);
    return mesa && mesa.activa ? mesa : null;
  }

  function normalizar({ mesa, claveIdempotencia, lineas }) {
    const mesaRegistrada = mesas.porToken(mesa);
    if (!mesaRegistrada) throw new PedidoError('La mesa no es válida');
    if (typeof claveIdempotencia !== 'string' || !claveIdempotencia.trim() || claveIdempotencia.length > 128) {
      throw new PedidoError('La clave de idempotencia es obligatoria y debe tener hasta 128 caracteres');
    }
    if (!Array.isArray(lineas) || lineas.length === 0) throw new PedidoError('Agrega al menos un plato antes de confirmar');
    const lineaIds = new Set();
    const normalizadas = lineas.map((linea, index) => {
      if (!linea || typeof linea !== 'object') throw new PedidoError('Cada línea debe ser válida');
      const lineaId = typeof linea.lineaId === 'string' && linea.lineaId ? linea.lineaId : String(index);
      if (lineaIds.has(lineaId)) throw new PedidoError('Cada línea debe tener un identificador distinto');
      lineaIds.add(lineaId);
      const platoId = entero(linea.platoId, 'El plato');
      const cantidad = entero(linea.cantidad, 'La cantidad');
      if (cantidad < 1 || cantidad > 20) throw new PedidoError('La cantidad debe estar entre 1 y 20');
      const precioCentavos = entero(linea.precioCentavos, 'El precio');
      if (precioCentavos < 0) throw new PedidoError('El precio no puede ser negativo');
      return { lineaId, platoId, cantidad, nota: notaValida(linea.nota), precioCentavos };
    });
    return { mesa: mesaRegistrada, claveIdempotencia: claveIdempotencia.trim(), lineas: normalizadas };
  }

  function evaluarLineas(lineas) {
    const ids = [...new Set(lineas.map((linea) => linea.platoId))];
    const publicables = new Map(catalogo.platosPublicables(ids).map((plato) => [plato.id, plato]));
    const todos = new Map(db.prepare(`SELECT p.id, p.nombre, p.agotado_temporalmente, c.archivada AS categoria_archivada
      FROM platos p JOIN categorias c ON c.id = p.categoria_id WHERE p.id IN (${ids.map(() => '?').join(', ')})`).all(...ids).map((plato) => [plato.id, plato]));
    const noDisponibles = [];
    const actuales = [];
    lineas.forEach((linea) => {
      const plato = publicables.get(linea.platoId);
      if (!plato) {
        const existente = todos.get(linea.platoId);
        noDisponibles.push({
          lineaId: linea.lineaId, platoId: linea.platoId, nombre: existente?.nombre || 'Plato no disponible',
          motivo: existente?.agotado_temporalmente ? 'agotado temporalmente' : 'no disponible'
        });
        return;
      }
      actuales.push({ ...linea, nombre: plato.nombre, precioCentavosVigente: plato.precio_centavos,
        subtotalCentavos: plato.precio_centavos * linea.cantidad });
    });
    return { noDisponibles, actuales };
  }

  const confirmarTransaccion = db.transaction((input) => {
    const pedido = normalizar(input);
    const hash = solicitudHash(pedido.lineas);
    const existente = db.prepare('SELECT id, solicitud_hash FROM pedidos WHERE mesa_id = ? AND clave_idempotencia = ?')
      .get(pedido.mesa.id, pedido.claveIdempotencia);
    if (existente) {
      if (existente.solicitud_hash !== hash) throw new PedidoError('La clave de idempotencia ya se usó con otro pedido', 409);
      return { tipo: 'confirmado', pedido: serializarPedido(db, existente.id), reintento: true };
    }

    if (!pedido.mesa.activa) throw new PedidoError('Esta mesa no acepta pedidos');

    const evaluacion = evaluarLineas(pedido.lineas);
    const lineas = evaluacion.actuales.map((linea) => ({
      lineaId: linea.lineaId, platoId: linea.platoId, nombre: linea.nombre, cantidad: linea.cantidad,
      nota: linea.nota, precioCentavos: linea.precioCentavosVigente, subtotalCentavos: linea.subtotalCentavos
    }));
    const totalCentavos = lineas.reduce((total, linea) => total + linea.subtotalCentavos, 0);
    const preciosModificados = lineas.filter((linea) => pedido.lineas.find((original) => original.lineaId === linea.lineaId).precioCentavos !== linea.precioCentavos);
    if (evaluacion.noDisponibles.length) return { tipo: 'no_disponible', noDisponibles: evaluacion.noDisponibles, preciosModificados, lineas, totalCentavos };
    if (preciosModificados.length) return { tipo: 'precio_modificado', preciosModificados, lineas, totalCentavos };

    const result = db.prepare(`INSERT INTO pedidos (mesa, mesa_id, total_centavos, clave_idempotencia, solicitud_hash)
      VALUES (?, ?, ?, ?, ?)`).run(pedido.mesa.nombre, pedido.mesa.id, totalCentavos, pedido.claveIdempotencia, hash);
    const insertarLinea = db.prepare(`INSERT INTO pedido_lineas
      (pedido_id, plato_id, nombre_plato, cantidad, nota, precio_unitario_centavos, subtotal_centavos)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);
    lineas.forEach((linea) => insertarLinea.run(result.lastInsertRowid, linea.platoId, linea.nombre,
      linea.cantidad, linea.nota, linea.precioCentavos, linea.subtotalCentavos));
    return { tipo: 'confirmado', pedido: serializarPedido(db, result.lastInsertRowid), reintento: false };
  });

  function confirmar(input) {
    const resultado = confirmarTransaccion(input);
    if (resultado.tipo === 'confirmado' && !resultado.reintento) publicar('pedido_nuevo', resultado.pedido.numero);
    return resultado;
  }

  return { resolverMesa, confirmar, instantanea, suscribir,
    iniciar: (numero) => cambiar(numero, 'iniciar'), servir: (numero) => cambiar(numero, 'servir'),
    cancelar: (numero) => cambiar(numero, 'cancelar') };
}
