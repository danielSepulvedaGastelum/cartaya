import { useEffect, useState } from 'react';
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
  const [confirmado, setConfirmado] = useState(null);
  const [intento, setIntento] = useState(null);
  const mesa = new URLSearchParams(location.search).get('mesa') || '';

  useEffect(() => { api(`/api/carta?mesa=${encodeURIComponent(mesa)}`).then(setData).catch((err) => setError(err.message)); }, [mesa]);
  const puedePedir = Boolean(data?.mesaValida);
  const subtotalPlato = (platoId) => lineas.filter((linea) => linea.platoId === platoId).reduce((suma, linea) => suma + linea.cantidad * linea.precioCentavos, 0);
  const cantidadPlato = (platoId) => lineas.filter((linea) => linea.platoId === platoId).reduce((suma, linea) => suma + linea.cantidad, 0);
  const normal = (platoId) => lineas.find((linea) => linea.platoId === platoId && !linea.especial);
  const cambiarLinea = (id, cambios) => setLineas((actuales) => actuales.map((linea) => linea.id === id ? { ...linea, ...cambios } : linea));
  const ajustarNormal = (plato, delta) => {
    const linea = normal(plato.id);
    if (delta > 0 && (!linea || linea.cantidad < 20)) {
      setLineas((actuales) => linea ? actuales.map((item) => item.id === linea.id ? { ...item, cantidad: item.cantidad + 1 } : item) : [...actuales, { id: idLinea(), platoId: plato.id, nombre: plato.nombre, cantidad: 1, nota: '', especial: false, precioCentavos: plato.precioCentavos }]);
    }
    if (delta < 0 && linea) setLineas((actuales) => linea.cantidad === 1 ? actuales.filter((item) => item.id !== linea.id) : actuales.map((item) => item.id === linea.id ? { ...item, cantidad: item.cantidad - 1 } : item));
  };
  const guardarEspecial = () => {
    if (!panel) return;
    setLineas((actuales) => [...actuales, { id: idLinea(), platoId: panel.plato.id, nombre: panel.plato.nombre, cantidad: panel.cantidad, nota: panel.nota, especial: true, precioCentavos: panel.plato.precioCentavos }]);
    setPanel(null);
  };
  const ajustarEspecial = (linea, delta) => {
    if (delta < 0 && linea.cantidad === 1) return setLineas((actuales) => actuales.filter((item) => item.id !== linea.id));
    if (linea.cantidad + delta >= 1 && linea.cantidad + delta <= 20) cambiarLinea(linea.id, { cantidad: linea.cantidad + delta });
  };
  async function confirmarPedido() {
    if (!lineas.length) return setMensaje('Agrega al menos un plato antes de confirmar');
    const clave = intento || idLinea(); setIntento(clave); setEnviando(true);
    try {
      const pedido = await api('/api/pedidos', { method: 'POST', body: JSON.stringify({ mesa, claveIdempotencia: clave, lineas: lineas.map(({ id, platoId, cantidad, nota, precioCentavos }) => ({ lineaId: id, platoId, cantidad, nota, precioCentavos })) }) });
      setConfirmado(pedido); setLineas([]); setIntento(null); setMensaje('Pedido confirmado');
    } catch (err) { setIntento(null); setMensaje(err.message); } finally { setEnviando(false); }
  }
  if (error) return <main><p role="alert">{error}</p></main>;
  if (!data) return <main><p aria-live="polite">Cargando la carta...</p></main>;
  let imageIndex = 0;
  return <><header className="portada"><p className="ceja">Cafetería de barrio</p><h1>La Estación</h1><p>Café honesto, cocina sencilla y un lugar para hacer una pausa.</p>{puedePedir ? <span className="mesa">Mesa identificada</span> : null}{data.mesaInactiva ? <p className="mensaje" role="status">Esta mesa ya no acepta pedidos.</p> : null}</header><main id="contenido" className="carta">
    {data.categorias.map((categoria) => <section key={categoria.id}><h2>{categoria.nombre}</h2><div className="platos">{categoria.platos.map((plato) => <article className="plato" key={plato.id}>{(imageIndex++, plato.fotoUrl ? <LazyImage src={plato.fotoUrl} alt={`Fotografía de ${plato.nombre}`} priority={imageIndex <= 1} /> : null)}<div className="plato-contenido"><div className="plato-titulo"><h3>{plato.nombre}</h3><strong>{precio.format(plato.precioCentavos / 100)}</strong></div><p>{plato.descripcion}</p>{plato.alergenos.length ? <p className="alergenos"><strong>Alérgenos:</strong> {plato.alergenos.join(', ')}</p> : null}{puedePedir ? <><div className="selector-cantidad" aria-label={`Cantidad de ${plato.nombre}`}><button type="button" onClick={() => ajustarNormal(plato, -1)} disabled={!normal(plato.id)}>−</button><strong>{cantidadPlato(plato.id)}</strong><button type="button" onClick={() => ajustarNormal(plato, 1)} disabled={normal(plato.id)?.cantidad >= 20}>+</button></div><p>Subtotal: {precio.format(subtotalPlato(plato.id) / 100)}</p><button type="button" className="boton-secundario" onClick={() => setPanel({ plato, nota: '', cantidad: 1 })}>Agregar indicaciones</button></> : null}</div></article>)}</div></section>)}
    {panel ? <section className="panel panel-indicacion" aria-label={`Indicaciones de ${panel.plato.nombre}`}><h2>Indicaciones para {panel.plato.nombre}</h2><label>Indicación (opcional)<textarea value={panel.nota} maxLength="140" onChange={(e) => setPanel({ ...panel, nota: e.target.value })} /></label><small>{panel.nota.length}/140. No incluyas datos personales.</small><div className="selector-cantidad"><button type="button" onClick={() => setPanel({ ...panel, cantidad: Math.max(1, panel.cantidad - 1) })}>−</button><strong>{panel.cantidad}</strong><button type="button" onClick={() => setPanel({ ...panel, cantidad: Math.min(20, panel.cantidad + 1) })}>+</button></div><button type="button" onClick={guardarEspecial}>Guardar indicación</button><button type="button" className="boton-secundario" onClick={() => setPanel(null)}>Cancelar</button></section> : null}
    {puedePedir && !confirmado ? <section className="resumen-pedido"><h2>Tu pedido</h2>{!lineas.length ? <p>Aún no agregas platos.</p> : <ul className="lineas-pedido">{lineas.map((linea) => <li key={linea.id}><h3>{linea.nombre}</h3>{linea.especial ? <><label>Indicación (opcional)<textarea value={linea.nota} maxLength="140" onChange={(e) => cambiarLinea(linea.id, { nota: e.target.value })} /></label><div className="selector-cantidad"><button type="button" onClick={() => ajustarEspecial(linea, -1)}>−</button><strong>{linea.cantidad}</strong><button type="button" onClick={() => ajustarEspecial(linea, 1)} disabled={linea.cantidad >= 20}>+</button></div></> : <p>Cantidad: {linea.cantidad}</p>}<p>{precio.format(linea.precioCentavos / 100)} c/u · {precio.format(linea.precioCentavos * linea.cantidad / 100)}</p><button type="button" onClick={() => setLineas((actuales) => actuales.filter((item) => item.id !== linea.id))}>Eliminar</button></li>)}</ul>}<p className="total-pedido"><strong>Total: {precio.format(lineas.reduce((suma, linea) => suma + linea.precioCentavos * linea.cantidad, 0) / 100)}</strong></p><button type="button" disabled={enviando} onClick={confirmarPedido}>{enviando ? 'Confirmando...' : 'Confirmar pedido'}</button></section> : null}
    {confirmado ? <section className="resumen-pedido"><h2>Pedido confirmado</h2><p>Número {confirmado.numero}. Estado: {confirmado.estado}</p><p>Total: {precio.format(confirmado.totalCentavos / 100)}</p></section> : null}{mensaje ? <p role="status" className="mensaje">{mensaje}</p> : null}
  </main></>;
}
