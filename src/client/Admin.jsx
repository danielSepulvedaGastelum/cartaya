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

  const cargar = useCallback(() => api('/api/admin/catalogo').then(setCatalogo).catch(() => setCatalogo(null)), []);
  useEffect(() => { cargar(); }, [cargar]);

  async function entrar(event) {
    event.preventDefault();
    try {
      await api('/api/sesion', { method: 'POST', body: JSON.stringify({ password }) });
      setPassword('');
      await cargar();
    } catch (error) { setMessage(error.message); }
  }

  async function action(url, options = { method: 'POST' }) {
    try {
      await api(url, options);
      setMessage('Cambios guardados');
      await cargar();
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
    if (globalThis.confirm(`Se restaurarán ${count} plato(s) junto con esta categoría. ¿Continuar?`)) {
      action(`/api/admin/categorias/${categoria.id}/restaurar`);
    }
  }

  if (!catalogo) return (
    <main className="admin estrecho">
      <h1>Administración</h1>
      <form onSubmit={entrar} className="panel">
        <label htmlFor="password">Contraseña del establecimiento</label>
        <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        <button type="submit">Iniciar sesión</button>
        {message ? <p role="alert">{message}</p> : null}
      </form>
    </main>
  );

  const activeCategories = catalogo.categorias.filter((item) => !item.archivada);
  return (
    <main className="admin">
      <div className="admin-header">
        <div><p className="ceja">La Estación</p><h1>Administrar carta</h1></div>
        <a className="boton-secundario" href="/">Ver carta</a>
      </div>
      {message ? <p className="mensaje" role="status">{message}</p> : null}

      <section className="panel">
        <h2>Categorías</h2>
        <form onSubmit={createCategory} className="fila-formulario">
          <label htmlFor="categoryName">Nombre de la categoría</label>
          <input id="categoryName" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} required />
          <button type="submit">{editingCategoryId ? 'Guardar categoría' : 'Agregar categoría'}</button>
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

      <section className="panel">
        <h2>{dish.id ? 'Editar plato' : 'Nuevo plato'}</h2>
        <form onSubmit={createDish} className="form-plato">
          <label>Nombre<input value={dish.nombre} onChange={(e) => setDish({ ...dish, nombre: e.target.value })} required /></label>
          <label>Descripción<textarea value={dish.descripcion} onChange={(e) => setDish({ ...dish, descripcion: e.target.value })} required /></label>
          <label>Precio en MXN<input type="number" min="0" step="0.01" value={dish.precio} onChange={(e) => setDish({ ...dish, precio: e.target.value })} required /></label>
          <label>Categoría<select value={dish.categoriaId} onChange={(e) => setDish({ ...dish, categoriaId: e.target.value })} required><option value="">Selecciona</option>{activeCategories.map((cat) => <option key={cat.id} value={cat.id}>{cat.nombre}</option>)}</select></label>
          <fieldset><legend>Alérgenos (opcional)</legend><div className="checks">{catalogo.alergenos.map((item) => <label key={item.id}><input type="checkbox" checked={dish.alergenos.includes(String(item.id))} onChange={() => toggleAllergen(item.id)} />{item.nombre}</label>)}</div></fieldset>
          <button type="submit">{dish.id ? 'Actualizar plato' : 'Guardar plato'}</button>
        </form>
      </section>

      <section className="panel">
        <h2>Platos</h2>
        <ul className="lista-admin platos-admin">
          {catalogo.platos.map((plato, index) => (
            <li key={plato.id}>
              <div><strong>{plato.nombre}</strong><span>${(plato.precio_centavos / 100).toFixed(2)} · {catalogo.categorias.find((cat) => cat.id === plato.categoria_id)?.nombre}</span></div>
              <div className="acciones">
                <button onClick={() => editDish(plato)}>Editar</button>
                {!plato.archivado && index > 0 ? <button onClick={() => reorderDishes(catalogo, plato, index, action)}>Subir</button> : null}
                <label className="boton-archivo">Foto<input aria-label={`Fotografía de ${plato.nombre}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => uploadPhoto(plato.id, event.target.files[0])} /></label>
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
