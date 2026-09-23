import crypto from 'node:crypto';

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
  const pedido = db.prepare('SELECT id, mesa, estado, total_centavos FROM pedidos WHERE id = ?').get(pedidoId);
  const lineas = db.prepare(`SELECT id, plato_id, nombre_plato, cantidad, nota,
    precio_unitario_centavos, subtotal_centavos FROM pedido_lineas WHERE pedido_id = ? ORDER BY id`).all(pedidoId);
  return {
    numero: pedido.id, mesa: pedido.mesa, estado: pedido.estado, totalCentavos: pedido.total_centavos,
    lineas: lineas.map((linea) => ({
      id: linea.id, platoId: linea.plato_id, nombre: linea.nombre_plato, cantidad: linea.cantidad, nota: linea.nota,
      precioUnitarioCentavos: linea.precio_unitario_centavos, subtotalCentavos: linea.subtotal_centavos
    }))
  };
}

export function createPedidos(db, mesas, catalogo) {
  function resolverMesa(token) {
    const mesa = mesas.porToken(token);
    return mesa && mesa.activa ? mesa : null;
  }

  function normalizar({ mesa, claveIdempotencia, lineas }) {
    const mesaRegistrada = mesas.porToken(mesa);
    if (mesaRegistrada && !mesaRegistrada.activa) throw new PedidoError('Esta mesa no acepta pedidos');
    const mesaResuelta = resolverMesa(mesa);
    if (!mesaResuelta) throw new PedidoError('La mesa no es valida');
    if (typeof claveIdempotencia !== 'string' || !claveIdempotencia.trim() || claveIdempotencia.length > 128) {
      throw new PedidoError('La clave de idempotencia es obligatoria y debe tener hasta 128 caracteres');
    }
    if (!Array.isArray(lineas) || lineas.length === 0) throw new PedidoError('Agrega al menos un plato antes de confirmar');
    const lineaIds = new Set();
    const normalizadas = lineas.map((linea, index) => {
      if (!linea || typeof linea !== 'object') throw new PedidoError('Cada l?nea debe ser v?lida');
      const lineaId = typeof linea.lineaId === 'string' && linea.lineaId ? linea.lineaId : String(index);
      if (lineaIds.has(lineaId)) throw new PedidoError('Cada l?nea debe tener un identificador distinto');
      lineaIds.add(lineaId);
      const platoId = entero(linea.platoId, 'El plato');
      const cantidad = entero(linea.cantidad, 'La cantidad');
      if (cantidad < 1 || cantidad > 20) throw new PedidoError('La cantidad debe estar entre 1 y 20');
      const precioCentavos = entero(linea.precioCentavos, 'El precio');
      if (precioCentavos < 0) throw new PedidoError('El precio no puede ser negativo');
      return { lineaId, platoId, cantidad, nota: notaValida(linea.nota), precioCentavos };
    });
    return { mesa: mesaResuelta, claveIdempotencia: claveIdempotencia.trim(), lineas: normalizadas };
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

  const confirmar = db.transaction((input) => {
    const pedido = normalizar(input);
    const hash = solicitudHash(pedido.lineas);
    const existente = db.prepare('SELECT id, solicitud_hash FROM pedidos WHERE mesa = ? AND clave_idempotencia = ?')
      .get(pedido.mesa.nombre, pedido.claveIdempotencia);
    if (existente) {
      if (existente.solicitud_hash !== hash) throw new PedidoError('La clave de idempotencia ya se us? con otro pedido', 409);
      return { tipo: 'confirmado', pedido: serializarPedido(db, existente.id), reintento: true };
    }

    const evaluacion = evaluarLineas(pedido.lineas);
    const lineas = evaluacion.actuales.map((linea) => ({
      lineaId: linea.lineaId, platoId: linea.platoId, nombre: linea.nombre, cantidad: linea.cantidad,
      nota: linea.nota, precioCentavos: linea.precioCentavosVigente, subtotalCentavos: linea.subtotalCentavos
    }));
    const totalCentavos = lineas.reduce((total, linea) => total + linea.subtotalCentavos, 0);
    if (evaluacion.noDisponibles.length) return { tipo: 'no_disponible', noDisponibles: evaluacion.noDisponibles, lineas, totalCentavos };
    const preciosModificados = lineas.filter((linea) => pedido.lineas.find((original) => original.lineaId === linea.lineaId).precioCentavos !== linea.precioCentavos);
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

  return { resolverMesa, confirmar };
}
