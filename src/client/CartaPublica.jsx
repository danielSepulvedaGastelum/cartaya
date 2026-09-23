import { useEffect, useState } from 'react';
import { api } from './api.js';
import { LazyImage } from './LazyImage.jsx';

const precio = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

export function CartaPublica() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [lineas, setLineas] = useState([]);
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [confirmado, setConfirmado] = useState(null);
  const [intento, setIntento] = useState(null);
  const mesa = new URLSearchParams(location.search).get('mesa') || '';

  useEffect(() => {
    api(`/api/carta?mesa=${encodeURIComponent(mesa)}`).then(setData).catch((err) => setError(err.message));
  }, [mesa]);

  function agregar(plato) {
    setLineas((actuales) => [...actuales, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      platoId: plato.id,
      nombre: plato.nombre,
      cantidad: 1,
      nota: '',
      precioCentavos: plato.precioCentavos
    }]);
    setMensaje('Plato agregado al pedido');
  }

  function cambiarLinea(id, cambios) {
    setLineas((actuales) => actuales.map((linea) => linea.id === id ? { ...linea, ...cambios } : linea));
  }

  function cambiarCantidad(id, valor) {
    const cantidad = Number(valor);
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 20) {
      setMensaje('La cantidad debe estar entre 1 y 20');
      return;
    }
    cambiarLinea(id, { cantidad });
  }

  function cambiarNota(id, nota) {
    if (nota.length > 140) {
      setMensaje('La nota no puede superar 140 caracteres');
      return;
    }
    cambiarLinea(id, { nota });
  }

  async function confirmarPedido() {
    if (!lineas.length) {
      setMensaje('Agrega al menos un plato antes de confirmar');
      return;
    }
    const clave = intento || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    setIntento(clave);
    setEnviando(true);
    try {
      const pedido = await api('/api/pedidos', { method: 'POST', body: JSON.stringify({
        mesa,
        claveIdempotencia: clave,
        lineas: lineas.map((linea) => ({ lineaId: linea.id, platoId: linea.platoId, cantidad: linea.cantidad, nota: linea.nota, precioCentavos: linea.precioCentavos }))
      }) });
      setConfirmado(pedido);
      setLineas([]);
      setIntento(null);
      setMensaje('Pedido confirmado');
    } catch (err) {
      const respuesta = err.body;
      if (respuesta?.tipo === 'no_disponible') {
        const retiradas = new Set(respuesta.noDisponibles.map((linea) => linea.lineaId));
        setLineas((actuales) => actuales.filter((linea) => !retiradas.has(linea.id)));
        setIntento(null);
        setMensaje(`Se retiraron platos no disponibles: ${respuesta.noDisponibles.map((linea) => linea.nombre).join(', ')}`);
      } else if (respuesta?.tipo === 'precio_modificado') {
        const vigentes = new Map(respuesta.lineas.map((linea) => [linea.lineaId, linea.precioCentavos]));
        setLineas((actuales) => actuales.map((linea) => vigentes.has(linea.id) ? { ...linea, precioCentavos: vigentes.get(linea.id) } : linea));
        setIntento(null);
        setMensaje('Los precios cambiaron. Revisa el nuevo total antes de confirmar.');
      } else {
        setMensaje(err.message);
      }
    } finally {
      setEnviando(false);
    }
  }

  if (error) return <main><p role="alert">{error}</p></main>;
  if (!data) return <main><p aria-live="polite">Cargando la carta...</p></main>;

  let imageIndex = 0;
  return <>
    <header className="portada">
      <p className="ceja">{'Cafeter\u00eda de barrio'}</p>
      <h1>{'La Estaci\u00f3n'}</h1>
      <p>Cafe honesto, cocina sencilla y un lugar para hacer una pausa.</p>
      {data.mesaValida ? <span className="mesa">Mesa identificada</span> : null}
    </header>
    <main id="contenido" className="carta">
      {data.categorias.length === 0 ? <p>Aun no hay platos publicados.</p> : null}
      {data.categorias.map((categoria) => <section key={categoria.id} aria-labelledby={`categoria-${categoria.id}`}>
        <h2 id={`categoria-${categoria.id}`}>{categoria.nombre}</h2>
        <div className="platos">{categoria.platos.map((plato) => {
          const priority = imageIndex++ < 1;
          return <article className="plato" key={plato.id}>
            {plato.fotoUrl ? <LazyImage src={plato.fotoUrl} alt={`Fotografia de ${plato.nombre}`} priority={priority} /> : null}
            <div className="plato-contenido">
              <div className="plato-titulo"><h3>{plato.nombre}</h3><strong>{precio.format(plato.precioCentavos / 100)}</strong></div>
              <p>{plato.descripcion}</p>
              {plato.alergenos.length > 0 ? <p className="alergenos"><strong>{'Al\u00e9rgenos:'}</strong> {plato.alergenos.join(', ')}</p> : null}
              {data.mesaValida ? <button type="button" onClick={() => agregar(plato)}>Agregar al pedido</button> : null}
            </div>
          </article>;
        })}</div>
      </section>)}
      {data.mesaValida && !confirmado ? <section className="resumen-pedido" aria-labelledby="titulo-pedido">
        <h2 id="titulo-pedido">Tu pedido</h2>
        {lineas.length === 0 ? <p>Aun no agregas platos.</p> : <ul className="lineas-pedido">{lineas.map((linea) => <li key={linea.id}>
          <h3>{linea.nombre}</h3>
          <label>Cantidad<input aria-label={`Cantidad de ${linea.nombre}`} type="number" min="1" max="20" value={linea.cantidad} onChange={(event) => cambiarCantidad(linea.id, event.target.value)} /></label>
          <label>Indicaciones (opcional)<textarea aria-label={`Indicaciones de ${linea.nombre}`} value={linea.nota} onChange={(event) => cambiarNota(linea.id, event.target.value)} /></label>
          <small>{linea.nota.length}/140. No incluyas datos personales.</small>
          <p>{precio.format(linea.precioCentavos / 100)} c/u - {precio.format((linea.precioCentavos * linea.cantidad) / 100)}</p>
          <button type="button" onClick={() => setLineas((actuales) => actuales.filter((actual) => actual.id !== linea.id))}>Eliminar</button>
        </li>)}</ul>}
        <p className="total-pedido"><strong>Total: {precio.format(lineas.reduce((total, linea) => total + linea.precioCentavos * linea.cantidad, 0) / 100)}</strong></p>
        <button type="button" disabled={enviando} onClick={confirmarPedido}>{enviando ? 'Confirmando...' : 'Confirmar pedido'}</button>
      </section> : null}
      {confirmado ? <section className="resumen-pedido" aria-labelledby="confirmacion-pedido">
        <h2 id="confirmacion-pedido">Pedido confirmado</h2>
        <p>Numero {confirmado.numero}. Estado: {confirmado.estado}</p>
        <p>Total: {precio.format(confirmado.totalCentavos / 100)}</p>
      </section> : null}
      {mensaje ? <p role="status" aria-live="polite" className="mensaje">{mensaje}</p> : null}
    </main>
  </>;
}
