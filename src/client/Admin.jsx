import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

const blankDish = { nombre: '', descripcion: '', precio: '', categoriaId: '', alergenos: [] };

export function Admin() {
  const [catalogo, setCatalogo] = useState(null);
  const [password, setPassword] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [dish, setDish] = useState(blankDish);
  const [message, setMessage] = useState('');
  const [seccion, setSeccion] = useState('productos');
  const [mesas, setMesas] = useState([]);

  const cargar = useCallback(() => api('/api/admin/catalogo').then(setCatalogo).catch(() => setCatalogo(null)), []);
  const cargarMesas = useCallback(() => api('/api/admin/mesas').then((data) => setMesas(data.mesas)).catch(() => setMesas([])), []);
  useEffect(() => { cargar(); }, [cargar]);

  async function entrar(event) {
    event.preventDefault();
    try {
      await api('/api/sesion', { method: 'POST', body: JSON.stringify({ password }) });
      setPassword('');
      await cargar();
      await cargarMesas();
    } catch (error) { setMessage(error.message); }
  }

  async function action(url, options = { method: 'POST' }) {
    try {
      await api(url, options);
      setMessage('Cambios guardados');
      await cargar();
      await cargarMesas();
    } catch (error) { setMessage(error.message); }
  }

  async function createCategory(event) {
    event.preventDefault();
    await action(editingCategoryId ? `/api/admin/categorias/${editingCategoryId}` : '/api/admin/categorias', {
      method: editingCategoryId ? 'PATCH' : 'POST',
      body: JSON.stringify({ nombre: categoryName })
    });
    setCategoryName('');
    setEditingCategoryId(null);
  }

  async function createDish(event) {
    event.preventDefault();
    await action(dish.id ? `/api/admin/platos/${dish.id}` : '/api/admin/platos', {
      method: dish.id ? 'PATCH' : 'POST',
      body: JSON.stringify({
        nombre: dish.nombre,
        descripcion: dish.descripcion,
        categoriaId: Number(dish.categoriaId),
        precioCentavos: Math.round(Number(dish.precio) * 100),
        alergenos: dish.alergenos.map(Number)
      })
    });
    setDish({ ...blankDish });
  }

  async function uploadPhoto(platoId, file) {
    if (!file) return;
    const data = new FormData();
    data.append('foto', file);
    await action(`/api/admin/platos/${platoId}/foto`, { method: 'POST', body: data });
  }

  function toggleAllergen(id) {
    setDish((current) => ({
      ...current,
      alergenos: current.alergenos.includes(String(id))
        ? current.alergenos.filter((value) => value !== String(id))
        : [...current.alergenos, String(id)]
    }));
  }

  function editDish(item) {
    setDish({
      id: item.id,
      nombre: item.nombre,
      descripcion: item.descripcion,
      precio: (item.precio_centavos / 100).toFixed(2),
      categoriaId: String(item.categoria_id),
      alergenos: item.alergenos.map((alergeno) => String(alergeno.id))
    });
    document.querySelector('.form-plato')?.scrollIntoView({ behavior: 'smooth' });
  }

  function restoreCategory(categoria) {
    const count = catalogo.platos.filter((item) => item.categoria_id === categoria.id && item.archivado_por_categoria).length;
    if (globalThis.confirm(`Se restaurarÃ¡n ${count} plato(s) junto con esta categorÃ­a. Â¿Continuar?`)) {
      action(`/api/admin/categorias/${categoria.id}/restaurar`);
    }
  }

  if (!catalogo) return (
    <main className="admin estrecho">
      <h1>AdministraciÃ³n</h1>
      <form onSubmit={entrar} className="panel">
        <label htmlFor="password">ContraseÃ±a del establecimiento</label>
        <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        <button type="submit">Iniciar sesiÃ³n</button>
        {message ? <p role="alert">{message}</p> : null}
      </form>
    </main>
  );

  const activeCategories = catalogo.categorias.filter((item) => !item.archivada);
  return (
    <main className={`admin ${seccion === 'mesas' ? 'viendo-mesas' : 'viendo-productos'}`}>
      <div className="admin-header">
        <div><p className="ceja">La EstaciÃ³n</p><h1>Administrar carta</h1></div>
        <a className="boton-secundario" href="/">Ver carta</a>
      </div>
      {message ? <p className="mensaje" role="status">{message}</p> : null}
      <nav className="admin-nav" aria-label="Secciones de administración">
        <button type="button" aria-pressed={seccion === 'productos'} onClick={() => setSeccion('productos')}>Productos</button>
        <button type="button" aria-pressed={seccion === 'mesas'} onClick={() => { setSeccion('mesas'); cargarMesas(); }}>Mesas</button>
      </nav>
      {seccion === 'mesas' ? <MesasPanel mesas={mesas} recargar={cargarMesas} mostrarMensaje={setMessage} /> : null}

      <section className="panel productos-panel">
        <h2>CategorÃ­as</h2>
        <form onSubmit={createCategory} className="fila-formulario">
          <label htmlFor="categoryName">Nombre de la categorÃ­a</label>
          <input id="categoryName" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} required />
          <button type="submit">{editingCategoryId ? 'Guardar categorÃ­a' : 'Agregar categorÃ­a'}</button>
        </form>
        <ul className="lista-admin">
          {catalogo.categorias.map((categoria, index) => (
            <li key={categoria.id}>
              <strong>{categoria.nombre}</strong>{categoria.archivada ? <span>Archivada</span> : null}
              <div className="acciones">
                <button onClick={() => { setCategoryName(categoria.nombre); setEditingCategoryId(categoria.id); }}>Editar</button>
                {!categoria.archivada && index > 0 ? <button onClick={() => reorderCategories(catalogo, index, -1, action)}>Subir</button> : null}
                {!categoria.archivada ? <button onClick={() => action(`/api/admin/categorias/${categoria.id}/archivar`)}>Archivar</button> : <button onClick={() => restoreCategory(categoria)}>Restaurar</button>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel productos-panel">
        <h2>{dish.id ? 'Editar plato' : 'Nuevo plato'}</h2>
        <form onSubmit={createDish} className="form-plato">
          <label>Nombre<input value={dish.nombre} onChange={(e) => setDish({ ...dish, nombre: e.target.value })} required /></label>
          <label>DescripciÃ³n<textarea value={dish.descripcion} onChange={(e) => setDish({ ...dish, descripcion: e.target.value })} required /></label>
          <label>Precio en MXN<input type="number" min="0" step="0.01" value={dish.precio} onChange={(e) => setDish({ ...dish, precio: e.target.value })} required /></label>
          <label>CategorÃ­a<select value={dish.categoriaId} onChange={(e) => setDish({ ...dish, categoriaId: e.target.value })} required><option value="">Selecciona</option>{activeCategories.map((cat) => <option key={cat.id} value={cat.id}>{cat.nombre}</option>)}</select></label>
          <fieldset><legend>AlÃ©rgenos (opcional)</legend><div className="checks">{catalogo.alergenos.map((item) => <label key={item.id}><input type="checkbox" checked={dish.alergenos.includes(String(item.id))} onChange={() => toggleAllergen(item.id)} />{item.nombre}</label>)}</div></fieldset>
          <button type="submit">{dish.id ? 'Actualizar plato' : 'Guardar plato'}</button>
        </form>
      </section>

      <section className="panel productos-panel">
        <h2>Platos</h2>
        <ul className="lista-admin platos-admin">
          {catalogo.platos.map((plato, index) => (
            <li key={plato.id}>
              <div><strong>{plato.nombre}</strong><span>${(plato.precio_centavos / 100).toFixed(2)} Â· {catalogo.categorias.find((cat) => cat.id === plato.categoria_id)?.nombre}</span></div>
              <div className="acciones">
                <button onClick={() => editDish(plato)}>Editar</button>
                {!plato.archivado && index > 0 ? <button onClick={() => reorderDishes(catalogo, plato, index, action)}>Subir</button> : null}
                <label className="boton-archivo">Foto<input aria-label={`Fotograf\u00eda de ${plato.nombre}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => uploadPhoto(plato.id, event.target.files[0])} /></label>
                {!plato.archivado ? (plato.agotado_temporalmente ? <button onClick={() => action(`/api/admin/platos/${plato.id}/reactivar`)}>Disponible</button> : <button onClick={() => action(`/api/admin/platos/${plato.id}/agotar`)}>Agotado</button>) : null}
                {!plato.archivado ? <button onClick={() => action(`/api/admin/platos/${plato.id}/archivar`)}>Archivar</button> : <button onClick={() => action(`/api/admin/platos/${plato.id}/restaurar`)}>Restaurar</button>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function reorderCategories(catalogo, index, delta, action) {
  const active = catalogo.categorias.filter((item) => !item.archivada);
  const currentIndex = active.findIndex((item) => item.id === catalogo.categorias[index].id);
  if (currentIndex + delta < 0) return;
  [active[currentIndex], active[currentIndex + delta]] = [active[currentIndex + delta], active[currentIndex]];
  action('/api/admin/categorias/orden', { method: 'PUT', body: JSON.stringify({ ids: active.map((item) => item.id) }) });
}

function reorderDishes(catalogo, plato, index, action) {
  const siblings = catalogo.platos.filter((item) => item.categoria_id === plato.categoria_id && !item.archivado);
  const currentIndex = siblings.findIndex((item) => item.id === plato.id);
  if (currentIndex < 1) return;
  [siblings[currentIndex], siblings[currentIndex - 1]] = [siblings[currentIndex - 1], siblings[currentIndex]];
  action(`/api/admin/categorias/${plato.categoria_id}/platos/orden`, { method: 'PUT', body: JSON.stringify({ ids: siblings.map((item) => item.id) }) });
}

function MesasPanel({ mesas, recargar, mostrarMensaje }) {
  const [nombre, setNombre] = useState('');
  const [edicion, setEdicion] = useState(null);
  const [historial, setHistorial] = useState({});
  async function guardar(event) { event.preventDefault(); try { await api(edicion ? `/api/admin/mesas/${edicion}` : '/api/admin/mesas', { method: edicion ? 'PATCH' : 'POST', body: JSON.stringify({ nombre }) }); setNombre(''); setEdicion(null); await recargar(); } catch (error) { mostrarMensaje(error.message); } }
  async function accion(url) { try { await api(url, { method: 'POST' }); await recargar(); } catch (error) { mostrarMensaje(error.message); } }
  async function verHistorial(id) { try { const data = await api(`/api/admin/mesas/${id}/historial`); setHistorial({ ...historial, [id]: data.pedidos }); } catch (error) { mostrarMensaje(error.message); } }
  return <section className="panel mesas-panel"><h2>Mesas</h2><form onSubmit={guardar} className="fila-formulario"><label>Nombre de la mesa<input value={nombre} onChange={(e) => setNombre(e.target.value)} required /></label><button type="submit">{edicion ? 'Guardar nombre' : 'Agregar mesa'}</button></form><ul className="lista-admin">{mesas.map((mesa) => <li key={mesa.id} className={mesa.activa ? '' : 'mesa-inactiva'}><div><strong>{mesa.nombre}</strong><span>{mesa.activa ? 'Activa' : 'Inactiva'}</span><a href={mesa.url}>{mesa.url}</a><img className="qr-mesa" src={`/api/admin/mesas/${mesa.id}/qr`} alt={`Código QR de ${mesa.nombre}`} /><div className="acciones"><a className="boton-secundario" href={`/api/admin/mesas/${mesa.id}/qr?descargar=1`}>Descargar QR</a><button type="button" onClick={() => { setEdicion(mesa.id); setNombre(mesa.nombre); }}>Renombrar</button><button type="button" onClick={() => verHistorial(mesa.id)}>Ver historial</button>{mesa.activa ? <button type="button" onClick={() => globalThis.confirm(`¿Desactivar ${mesa.nombre}?`) && accion(`/api/admin/mesas/${mesa.id}/desactivar`)}>Desactivar</button> : <button type="button" onClick={() => accion(`/api/admin/mesas/${mesa.id}/reactivar`)}>Reactivar</button>}</div>{historial[mesa.id] ? <ul className="historial-mesa">{historial[mesa.id].length ? historial[mesa.id].map((pedido) => <li key={pedido.numero}>Pedido {pedido.numero}: ${(pedido.totalCentavos / 100).toFixed(2)}</li>) : <li>Aún no hay pedidos.</li>}</ul> : null}</div></li>)}</ul></section>;
}
