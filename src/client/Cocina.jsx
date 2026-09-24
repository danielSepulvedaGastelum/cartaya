import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { avisarPedido } from './sonido.js';

const columnas = [
  ['recibidos', 'Recibidos'], ['enPreparacion', 'En preparación'],
  ['servidos', 'Servidos'], ['cancelados', 'Cancelados']
];
const estados = { recibido: 'Recibido', en_preparacion: 'En preparación', servido: 'Servido' };

function reconciliar(data) {
  const unicos = new Map(columnas.flatMap(([clave]) => data[clave] || []).map((p) => [p.numero, p]));
  const resultado = Object.fromEntries(columnas.map(([clave]) => [clave, []]));
  for (const pedido of unicos.values()) {
    const clave = pedido.canceladoEn ? 'cancelados' : pedido.estado === 'servido' ? 'servidos'
      : pedido.estado === 'en_preparacion' ? 'enPreparacion' : 'recibidos';
    resultado[clave].push(pedido);
  }
  for (const [clave] of columnas) {
    const campo = clave === 'servidos' ? 'servidoEn' : clave === 'cancelados' ? 'canceladoEn' : 'creadoEn';
    const signo = ['recibidos', 'enPreparacion'].includes(clave) ? 1 : -1;
    resultado[clave].sort((a, b) => signo * (a[campo].localeCompare(b[campo]) || a.numero - b.numero));
  }
  return resultado;
}

function Hora({ etiqueta, valor }) {
  return valor && <div>{etiqueta}: <time dateTime={valor}>{new Date(valor).toLocaleString('es-MX')}</time></div>;
}

export function Cocina() {
  const [vista, setVista] = useState(null);
  const [acceso, setAcceso] = useState(false);
  const [password, setPassword] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [desconectado, setDesconectado] = useState(false);
  const [ahora, setAhora] = useState(Date.now());
  const [sesion, setSesion] = useState(0);
  const [pendiente, setPendiente] = useState(null);
  const expirarRef = useRef(() => {});

  useEffect(() => {
    let desmontado = false, expirada = false, stream, vencimiento;
    let interrumpido = false;
    const conocidos = new Set();
    const expirar = () => {
      if (desmontado) return;
      expirada = true;
      stream?.close(); clearTimeout(vencimiento);
      setVista(null); setAcceso(true); setDesconectado(false);
    };
    expirarRef.current = expirar;
    const aplicar = (data, tipo) => {
      const siguiente = reconciliar(data);
      const activos = [...siguiente.recibidos, ...siguiente.enPreparacion];
      if (tipo === 'pedido_nuevo') {
        if (activos.some((p) => p.numero === data.numero && !conocidos.has(p.numero))) void avisarPedido();
      } else if (tipo === 'snapshot' && interrumpido) {
        activos.filter((p) => !conocidos.has(p.numero)).forEach(() => { void avisarPedido(); });
      }
      columnas.forEach(([clave]) => siguiente[clave].forEach((p) => conocidos.add(p.numero)));
      setVista(siguiente);
      if (tipo === 'snapshot') { interrumpido = false; setDesconectado(false); }
    };
    async function cargar() {
      try {
        const data = await api('/api/cocina');
        if (desmontado) return;
        const restante = new Date(data.sesionExpiraEn).getTime() - Date.now();
        if (restante <= 0) { expirar(); return; }
        setAcceso(false); aplicar(data, 'inicial');
        vencimiento = setTimeout(expirar, restante);
        stream = new EventSource('/api/cocina/eventos');
        for (const tipo of ['snapshot', 'pedido_nuevo', 'pedidos_actualizados']) {
          stream.addEventListener(tipo, (event) => {
            if (!desmontado && !expirada) aplicar(JSON.parse(event.data), tipo);
          });
        }
        stream.onerror = () => {
          if (desmontado || expirada) return;
          setDesconectado(true);
          if (interrumpido) return;
          interrumpido = true;
          // Comprobar la sesión una vez por interrupción; EventSource se reconecta solo.
          api('/api/cocina').catch((error) => { if (error.status === 401) expirar(); });
        };
      } catch (error) {
        if (desmontado) return;
        if (error.status === 401) expirar(); else setMensaje(error.message);
      }
    }
    cargar();
    const reloj = setInterval(() => setAhora(Date.now()), 1000);
    return () => { desmontado = true; stream?.close(); clearTimeout(vencimiento); clearInterval(reloj); };
  }, [sesion]);

  async function entrar(event) {
    event.preventDefault(); setMensaje('');
    try {
      await api('/api/sesion', { method: 'POST', body: JSON.stringify({ password }) });
      setPassword(''); setSesion((valor) => valor + 1);
    } catch (error) { setMensaje(error.message); }
  }

  async function actuar(numero, accion) {
    if (accion === 'servir' && !window.confirm('¿Confirmas que el pedido #' + numero + ' fue servido?')) return;
    if (accion === 'cancelar' && !window.confirm('¿Confirmas cancelar el pedido #' + numero + '? Esta acción es irreversible.')) return;
    setPendiente(numero); setMensaje('');
    try { await api('/api/cocina/pedidos/' + numero + '/' + accion, { method: 'POST' }); }
    catch (error) { if (error.status === 401) expirarRef.current(); else setMensaje(error.message); }
    finally { setPendiente(null); }
  }

  if (acceso) return <main className="admin estrecho">
    <h1>Acceso a cocina</h1>
    <p>Ingresa la contraseña del establecimiento.</p>
    <form className="panel fila-formulario" onSubmit={entrar}>
      <label>Contraseña<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <button>Entrar</button>
    </form>{mensaje && <p role="alert">{mensaje}</p>}
  </main>;

  if (!vista) return <main className="admin"><h1>Cocina</h1>
    {mensaje ? <><p role="alert">{mensaje}</p><button onClick={() => { setMensaje(''); setSesion((v) => v + 1); }}>Reintentar</button></> : <p role="status">Cargando pedidos…</p>}
  </main>;

  return <main className="cocina">
    <header className="cocina-cabecera"><h1>Cocina</h1><a href="/admin">Administración</a>
      <nav aria-label="Estados de pedidos">{columnas.map(([clave, titulo]) =>
        <a key={clave} href={'#' + clave}>{titulo} ({vista[clave].length})</a>)}</nav>
    </header>
    {desconectado && <p className="cocina-aviso" role="alert">Sin conexión. Los pedidos pueden estar desactualizados. Reconectando…</p>}
    {mensaje && <p className="mensaje" role="alert">{mensaje}</p>}
    <div className="cocina-columnas">{columnas.map(([clave, titulo]) => <section key={clave} id={clave} aria-labelledby={clave + '-titulo'} className="cocina-columna">
      <h2 id={clave + '-titulo'}>{titulo}</h2>
      {['servidos', 'cancelados'].includes(clave) && <p>Histórico de hoy</p>}
      {!vista[clave].length && <p>Sin pedidos</p>}
      {vista[clave].map((pedido) => <article className="cocina-pedido" key={pedido.numero} aria-labelledby={'pedido-' + pedido.numero}>
        <h3 id={'pedido-' + pedido.numero}>Pedido #{pedido.numero} · Mesa {pedido.mesa}</h3>
        <p>{pedido.canceladoEn ? 'Cancelado · Preparación: ' : ''}{estados[pedido.estado]}</p>
        <p className="cocina-tiempo">{Math.max(0, Math.floor((ahora - new Date(pedido.creadoEn).getTime()) / 60000))} min desde la confirmación</p>
        <ul>{pedido.lineas.map((linea) => <li key={linea.id}><strong>{linea.cantidad} × {linea.nombre}</strong>{linea.nota && <p className="cocina-nota">Nota: {linea.nota}</p>}</li>)}</ul>
        <div className="cocina-horas"><Hora etiqueta="Recibido" valor={pedido.creadoEn} />
          <Hora etiqueta="Preparación" valor={pedido.enPreparacionEn} /><Hora etiqueta="Servido" valor={pedido.servidoEn} />
          <Hora etiqueta="Cancelado" valor={pedido.canceladoEn} /></div>
        <div className="cocina-acciones">
          {clave === 'recibidos' && <><button disabled={pendiente === pedido.numero} onClick={() => actuar(pedido.numero, 'iniciar')}>Iniciar preparación</button>
            <button className="cocina-cancelar" disabled={pendiente === pedido.numero} onClick={() => actuar(pedido.numero, 'cancelar')}>Cancelar pedido</button></>}
          {clave === 'enPreparacion' && <button disabled={pendiente === pedido.numero} onClick={() => actuar(pedido.numero, 'servir')}>Servir pedido</button>}
        </div>
      </article>)}
    </section>)}</div>
  </main>;
}
