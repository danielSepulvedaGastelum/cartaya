import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { LazyImage } from './LazyImage.jsx';

const precio = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const idLinea = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

export function CartaPublica() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [lineas, setLineas] = useState([]);
  const [panel, setPanel] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [incierto, setIncierto] = useState(false);
  const [confirmado, setConfirmado] = useState(null);
  const [intento, setIntento] = useState(null);
  const [recargando, setRecargando] = useState(false);
  const envioRef = useRef(false);
  const mesa = new URLSearchParams(location.search).get('mesa') || '';

  useEffect(() => { api(`/api/carta?mesa=${encodeURIComponent(mesa)}`).then(setData).catch((err) => setError(err.message)); }, [mesa]);
  const puedePedir = Boolean(data?.mesaValida && !confirmado);
  const bloqueado = enviando || incierto;
  const puedeEditar = puedePedir && !bloqueado;
  const subtotalPlato = (platoId) => lineas.filter((linea) => linea.platoId === platoId).reduce((suma, linea) => suma + linea.cantidad * linea.precioCentavos, 0);
  const cantidadPlato = (platoId) => lineas.filter((linea) => linea.platoId === platoId).reduce((suma, linea) => suma + linea.cantidad, 0);
  const normal = (platoId) => lineas.find((linea) => linea.platoId === platoId && !linea.especial);
  const cambiarLinea = (id, cambios) => {
    if (!puedeEditar) return;
    setLineas((actuales) => actuales.map((linea) => {
      if (linea.id !== id) return linea;
      const editada = { ...linea, ...cambios };
      if (!linea.especial && typeof cambios.nota === 'string' && cambios.nota.length > 0) editada.especial = true;
      return editada;
    }));
  };
  const ajustarNormal = (plato, delta) => {
    if (!puedeEditar) return;
    const linea = normal(plato.id);
    if (delta > 0 && (!linea || linea.cantidad < 20)) {
      setLineas((actuales) => linea ? actuales.map((item) => item.id === linea.id ? { ...item, cantidad: item.cantidad + 1 } : item) : [...actuales, { id: idLinea(), platoId: plato.id, nombre: plato.nombre, cantidad: 1, nota: '', especial: false, precioCentavos: plato.precioCentavos }]);
    } else if (delta > 0) setMensaje('El máximo es 20 unidades por línea');
    if (delta < 0 && linea) setLineas((actuales) => linea.cantidad === 1 ? actuales.filter((item) => item.id !== linea.id) : actuales.map((item) => item.id === linea.id ? { ...item, cantidad: item.cantidad - 1 } : item));
  };
  const guardarEspecial = () => {
    if (!panel || !puedeEditar) return;
    if (panel.nota.length > 140) return setMensaje('La nota no puede superar 140 caracteres');
    setLineas((actuales) => [...actuales, { id: idLinea(), platoId: panel.plato.id, nombre: panel.plato.nombre, cantidad: panel.cantidad, nota: panel.nota, especial: true, precioCentavos: panel.plato.precioCentavos }]);
    setPanel(null);
  };
  const ajustarEspecial = (linea, delta) => {
    if (!puedeEditar) return;
    if (delta < 0 && linea.cantidad === 1) return setLineas((actuales) => actuales.filter((item) => item.id !== linea.id));
    if (linea.cantidad + delta >= 1 && linea.cantidad + delta <= 20) cambiarLinea(linea.id, { cantidad: linea.cantidad + delta });
    else if (delta > 0) setMensaje('El máximo es 20 unidades por línea');
  };
  const editarNota = (id, nota) => {
    if (nota.length > 140) return setMensaje('La nota no puede superar 140 caracteres');
    setMensaje(''); cambiarLinea(id, { nota });
  };

  function reconciliar(body) {
    const retirados = new Set((body.noDisponibles || []).map((item) => item.lineaId));
    const vigentes = new Map((body.lineas || []).map((item) => [item.lineaId, item]));
    setLineas((actuales) => actuales.filter((linea) => !retirados.has(linea.id) && vigentes.has(linea.id))
      .map((linea) => ({ ...linea, precioCentavos: vigentes.get(linea.id).precioCentavos })));
    const platosRetirados = new Set((body.noDisponibles || []).map((item) => item.platoId));
    const precios = new Map((body.lineas || []).map((item) => [item.platoId, item.precioCentavos]));
    setData((anterior) => ({ ...anterior, categorias: anterior.categorias.map((categoria) => ({
      ...categoria, platos: categoria.platos.filter((plato) => !platosRetirados.has(plato.id))
        .map((plato) => ({ ...plato, precioCentavos: precios.get(plato.id) ?? plato.precioCentavos }))
    })).filter((categoria) => categoria.platos.length) }));
    setPanel((actual) => actual && platosRetirados.has(actual.plato.id) ? null : actual && precios.has(actual.plato.id)
      ? { ...actual, plato: { ...actual.plato, precioCentavos: precios.get(actual.plato.id) } } : actual);
    const nombres = (body.noDisponibles || []).map((item) => `${item.nombre} (${item.motivo})`);
    const precioCambiado = (body.preciosModificados || []).length > 0 || body.tipo === 'precio_modificado';
    setMensaje([nombres.length ? `Retirados: ${nombres.join(', ')}.` : '', precioCambiado ? `Precios actualizados. Nuevo total: ${precio.format(body.totalCentavos / 100)}. Revisa antes de confirmar.` : ''].filter(Boolean).join(' '));
  }

  async function enviarPedido(payload) {
    if (envioRef.current) return;
    envioRef.current = true; setEnviando(true); setIncierto(false); setMensaje('');
    try {
      const pedido = await api('/api/pedidos', { method: 'POST', body: JSON.stringify(payload) });
      if (!Number.isInteger(pedido?.numero) || pedido.estado !== 'recibido' || !Number.isInteger(pedido.totalCentavos)) {
        throw new Error('La respuesta de confirmación está incompleta');
      }
      setConfirmado(pedido); setLineas([]); setIntento(null); setMensaje('Pedido confirmado');
    } catch (err) {
      if (err.status === 409 && ['no_disponible', 'precio_modificado'].includes(err.body?.tipo) && Array.isArray(err.body.lineas)) {
        reconciliar(err.body); setIntento(null);
      } else if (err.status === 400 || err.status === 404) {
        setIntento(null); setMensaje(err.message);
      } else {
        setIncierto(true);
        setMensaje(`No pudimos comprobar si el pedido se registró. Reintenta el mismo envío. ${err.message}`);
      }
    } finally { envioRef.current = false; setEnviando(false); }
  }
  function confirmarPedido() {
    if (envioRef.current || incierto || confirmado) return;
    if (!lineas.length) return setMensaje('Agrega al menos un plato antes de confirmar');
    const payload = { mesa, claveIdempotencia: idLinea(), lineas: lineas.map(({ id, platoId, cantidad, nota, precioCentavos }) => ({ lineaId: id, platoId, cantidad, nota, precioCentavos })) };
    setIntento(payload); void enviarPedido(payload);
  }
  async function otroPedido() {
    if (recargando) return;
    setRecargando(true); setMensaje('');
    try {
      const nueva = await api(`/api/carta?mesa=${encodeURIComponent(mesa)}`);
      setData(nueva); setPanel(null); setLineas([]); setIntento(null); setConfirmado(null);
      if (!nueva.mesaValida) setMensaje('Esta mesa no acepta pedidos. Puedes consultar la carta.');
    } catch (err) { setMensaje(`No se pudo actualizar la carta. Intenta de nuevo. ${err.message}`); }
    finally { setRecargando(false); }
  }

  if (error) return <main><p role="alert">{error}</p></main>;
  if (!data) return <main><p aria-live="polite">Cargando la carta...</p></main>;
  let imageIndex = 0;
  return <><header className="portada"><p className="ceja">Cafetería de barrio</p><h1>La Estación</h1><p>Café honesto, cocina sencilla y un lugar para hacer una pausa.</p>{puedePedir ? <span className="mesa">Mesa identificada</span> : null}{data.mesaInactiva ? <p className="mensaje" role="status">Esta mesa ya no acepta pedidos.</p> : null}</header><main id="contenido" className="carta">
    {data.categorias.map((categoria) => <section key={categoria.id}><h2>{categoria.nombre}</h2><div className="platos">{categoria.platos.map((plato) => <article className="plato" key={plato.id}>{(imageIndex++, plato.fotoUrl ? <LazyImage src={plato.fotoUrl} alt={`Fotografía de ${plato.nombre}`} priority={imageIndex <= 1} /> : null)}<div className="plato-contenido"><div className="plato-titulo"><h3>{plato.nombre}</h3><strong>{precio.format(plato.precioCentavos / 100)}</strong></div><p>{plato.descripcion}</p>{plato.alergenos.length ? <p className="alergenos"><strong>Alérgenos:</strong> {plato.alergenos.join(', ')}</p> : null}{puedePedir ? <><div className="selector-cantidad" aria-label={`Cantidad de ${plato.nombre}`}><button type="button" onClick={() => ajustarNormal(plato, -1)} disabled={!puedeEditar || !normal(plato.id)}>−</button><strong>{cantidadPlato(plato.id)}</strong><button type="button" onClick={() => ajustarNormal(plato, 1)} disabled={!puedeEditar || normal(plato.id)?.cantidad >= 20}>+</button></div>{normal(plato.id)?.cantidad >= 20 ? <small>El máximo es 20 unidades por línea</small> : null}<p>Subtotal: {precio.format(subtotalPlato(plato.id) / 100)}</p><button type="button" className="boton-secundario" disabled={!puedeEditar} onClick={() => setPanel({ plato, nota: '', cantidad: 1 })}>Agregar indicaciones</button></> : null}</div></article>)}</div></section>)}
    {panel && puedePedir ? <section className="panel panel-indicacion" aria-label={`Indicaciones de ${panel.plato.nombre}`}><h2>Indicaciones para {panel.plato.nombre}</h2><label>Indicación (opcional)<textarea value={panel.nota} disabled={!puedeEditar} onChange={(e) => setPanel({ ...panel, nota: e.target.value })} /></label><small>{panel.nota.length}/140. No incluyas datos personales.</small><div className="selector-cantidad"><button type="button" disabled={!puedeEditar} onClick={() => setPanel({ ...panel, cantidad: Math.max(1, panel.cantidad - 1) })}>−</button><strong>{panel.cantidad}</strong><button type="button" disabled={!puedeEditar} onClick={() => panel.cantidad >= 20 ? setMensaje('El m\u00e1ximo es 20 unidades por l\u00ednea') : setPanel({ ...panel, cantidad: panel.cantidad + 1 })}>+</button></div><button type="button" disabled={!puedeEditar} onClick={guardarEspecial}>Guardar indicación</button><button type="button" disabled={!puedeEditar} className="boton-secundario" onClick={() => setPanel(null)}>Cancelar</button></section> : null}
    {puedePedir ? <section className="resumen-pedido"><h2>Tu pedido</h2>{!lineas.length ? <p>Aún no agregas platos.</p> : <ul className="lineas-pedido">{lineas.map((linea) => <li key={linea.id}><h3>{linea.nombre}</h3><label>Indicación (opcional)<textarea value={linea.nota} disabled={!puedeEditar} onChange={(e) => editarNota(linea.id, e.target.value)} /></label>{linea.especial ? <div className="selector-cantidad"><button type="button" disabled={!puedeEditar} onClick={() => ajustarEspecial(linea, -1)}>−</button><strong>{linea.cantidad}</strong><button type="button" disabled={!puedeEditar || linea.cantidad >= 20} onClick={() => ajustarEspecial(linea, 1)}>+</button></div> : <p>Cantidad: {linea.cantidad}</p>}<p>{precio.format(linea.precioCentavos / 100)} c/u · {precio.format(linea.precioCentavos * linea.cantidad / 100)}</p><button type="button" disabled={!puedeEditar} onClick={() => setLineas((actuales) => actuales.filter((item) => item.id !== linea.id))}>Eliminar</button></li>)}</ul>}<p className="privacidad-nota">No incluyas datos personales en las indicaciones.</p><p className="total-pedido"><strong>Total: {precio.format(lineas.reduce((suma, linea) => suma + linea.precioCentavos * linea.cantidad, 0) / 100)}</strong></p>{incierto ? <button type="button" disabled={enviando} onClick={() => intento && void enviarPedido(intento)}>Reintentar el mismo envío</button> : <button type="button" disabled={enviando || !lineas.length} onClick={confirmarPedido}>{enviando ? 'Confirmando...' : 'Confirmar pedido'}</button>}</section> : null}
    {confirmado ? <section className="resumen-pedido"><h2>Pedido confirmado</h2><p>Número {confirmado.numero}. Estado: {confirmado.estado}</p><p>Total: {precio.format(confirmado.totalCentavos / 100)}</p><button type="button" disabled={recargando} onClick={() => void otroPedido()}>{recargando ? 'Actualizando carta...' : 'Hacer otro pedido'}</button></section> : null}{mensaje ? <p role="status" className="mensaje">{mensaje}</p> : null}
  </main></>;
}
