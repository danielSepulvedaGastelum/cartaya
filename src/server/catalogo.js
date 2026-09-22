function entero(value, campo) {
  const number = Number(value);
  if (!Number.isInteger(number)) throw new Error(`${campo} debe ser un entero`);
  return number;
}

function texto(value, campo) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${campo} es obligatorio`);
  return value.trim();
}

export function createCatalogo(db) {
  const allergenQuery = `
    SELECT a.id, a.nombre FROM alergenos a
    JOIN plato_alergenos pa ON pa.alergeno_id = a.id
    WHERE pa.plato_id = ? ORDER BY a.id`;

  function alergenosDe(platoId) {
    return db.prepare(allergenQuery).all(platoId);
  }

  function guardarAlergenos(platoId, ids = []) {
    const unique = [...new Set(ids.map((id) => entero(id, 'alérgeno')))];
    db.prepare('DELETE FROM plato_alergenos WHERE plato_id = ?').run(platoId);
    const insert = db.prepare('INSERT INTO plato_alergenos (plato_id, alergeno_id) VALUES (?, ?)');
    unique.forEach((id) => insert.run(platoId, id));
  }

  const crearCategoria = db.transaction(({ nombre, orden }) => {
    const result = db.prepare('INSERT INTO categorias (nombre, orden) VALUES (?, ?)')
      .run(texto(nombre, 'nombre'), Number.isInteger(orden) ? orden : siguienteOrdenCategoria());
    return categoria(result.lastInsertRowid);
  });

  function siguienteOrdenCategoria() {
    return db.prepare('SELECT COALESCE(MAX(orden), -1) + 1 AS orden FROM categorias').get().orden;
  }

  function categoria(id) {
    return db.prepare('SELECT * FROM categorias WHERE id = ?').get(id);
  }

  function categoriasAdmin() {
    return db.prepare('SELECT * FROM categorias ORDER BY archivada, orden, id').all();
  }

  function editarCategoria(id, datos) {
    const current = categoria(id);
    if (!current) return null;
    db.prepare('UPDATE categorias SET nombre = ?, orden = ? WHERE id = ?').run(
      datos.nombre === undefined ? current.nombre : texto(datos.nombre, 'nombre'),
      datos.orden === undefined ? current.orden : entero(datos.orden, 'orden'),
      id
    );
    return categoria(id);
  }

  const archivarCategoria = db.transaction((id) => {
    const result = db.prepare('UPDATE categorias SET archivada = 1 WHERE id = ?').run(id);
    if (!result.changes) return null;
    db.prepare(`UPDATE platos SET archivado = 1, archivado_por_categoria = 1
      WHERE categoria_id = ? AND archivado = 0`).run(id);
    return categoria(id);
  });

  const restaurarCategoria = db.transaction((id) => {
    const result = db.prepare('UPDATE categorias SET archivada = 0 WHERE id = ?').run(id);
    if (!result.changes) return null;
    db.prepare(`UPDATE platos SET archivado = 0, archivado_por_categoria = 0
      WHERE categoria_id = ? AND archivado_por_categoria = 1`).run(id);
    return categoria(id);
  });

  function reordenarCategorias(ids) {
    db.transaction(() => ids.forEach((id, index) => {
      db.prepare('UPDATE categorias SET orden = ? WHERE id = ?').run(index, entero(id, 'id'));
    }))();
    return categoriasAdmin();
  }

  function plato(id) {
    const item = db.prepare('SELECT * FROM platos WHERE id = ?').get(id);
    return item ? { ...item, alergenos: alergenosDe(id) } : null;
  }

  function platosAdmin() {
    return db.prepare('SELECT * FROM platos ORDER BY categoria_id, archivado, orden, id').all()
      .map((item) => ({ ...item, alergenos: alergenosDe(item.id) }));
  }

  const crearPlato = db.transaction((datos) => {
    const categoriaId = entero(datos.categoriaId, 'categoría');
    if (!categoria(categoriaId)) throw new Error('La categoría no existe');
    const precioCentavos = entero(datos.precioCentavos, 'precio');
    if (precioCentavos < 0) throw new Error('El precio no puede ser negativo');
    const orden = Number.isInteger(datos.orden)
      ? datos.orden
      : db.prepare('SELECT COALESCE(MAX(orden), -1) + 1 AS orden FROM platos WHERE categoria_id = ?').get(categoriaId).orden;
    const result = db.prepare(`INSERT INTO platos
      (categoria_id, nombre, descripcion, precio_centavos, orden)
      VALUES (?, ?, ?, ?, ?)`).run(
      categoriaId,
      texto(datos.nombre, 'nombre'),
      texto(datos.descripcion, 'descripción'),
      precioCentavos,
      orden
    );
    guardarAlergenos(result.lastInsertRowid, datos.alergenos || []);
    return plato(result.lastInsertRowid);
  });

  const editarPlato = db.transaction((id, datos) => {
    const current = plato(id);
    if (!current) return null;
    const categoriaId = datos.categoriaId === undefined ? current.categoria_id : entero(datos.categoriaId, 'categoría');
    const precio = datos.precioCentavos === undefined ? current.precio_centavos : entero(datos.precioCentavos, 'precio');
    if (!categoria(categoriaId)) throw new Error('La categoría no existe');
    if (precio < 0) throw new Error('El precio no puede ser negativo');
    db.prepare(`UPDATE platos SET categoria_id = ?, nombre = ?, descripcion = ?,
      precio_centavos = ?, orden = ? WHERE id = ?`).run(
      categoriaId,
      datos.nombre === undefined ? current.nombre : texto(datos.nombre, 'nombre'),
      datos.descripcion === undefined ? current.descripcion : texto(datos.descripcion, 'descripción'),
      precio,
      datos.orden === undefined ? current.orden : entero(datos.orden, 'orden'),
      id
    );
    if (datos.alergenos !== undefined) guardarAlergenos(id, datos.alergenos);
    return plato(id);
  });

  function archivarPlato(id) {
    const result = db.prepare('UPDATE platos SET archivado = 1, archivado_por_categoria = 0 WHERE id = ?').run(id);
    return result.changes ? plato(id) : null;
  }

  function restaurarPlato(id) {
    const item = plato(id);
    if (!item) return null;
    const cat = categoria(item.categoria_id);
    if (cat.archivada) throw new Error('Restaura primero la categoría');
    db.prepare('UPDATE platos SET archivado = 0, archivado_por_categoria = 0 WHERE id = ?').run(id);
    return plato(id);
  }

  function reordenarPlatos(categoriaId, ids) {
    db.transaction(() => ids.forEach((id, index) => {
      db.prepare('UPDATE platos SET orden = ? WHERE id = ? AND categoria_id = ?')
        .run(index, entero(id, 'id'), entero(categoriaId, 'categoría'));
    }))();
    return platosAdmin().filter((item) => item.categoria_id === Number(categoriaId));
  }

  function asignarFoto(id, fotoUrl) {
    const result = db.prepare("UPDATE platos SET foto_url = ?, foto_mime = 'image/webp' WHERE id = ?")
      .run(fotoUrl, id);
    return result.changes ? plato(id) : null;
  }

  function cartaPublica() {
    const cats = db.prepare(`SELECT c.* FROM categorias c
      WHERE c.archivada = 0 AND EXISTS (
        SELECT 1 FROM platos p WHERE p.categoria_id = c.id AND p.archivado = 0
      ) ORDER BY c.orden, c.id`).all();
    const dishStatement = db.prepare(`SELECT * FROM platos
      WHERE categoria_id = ? AND archivado = 0 ORDER BY orden, id`);
    return cats.map((cat) => ({
      id: cat.id,
      nombre: cat.nombre,
      orden: cat.orden,
      platos: dishStatement.all(cat.id).map((item) => ({
        id: item.id,
        nombre: item.nombre,
        descripcion: item.descripcion,
        precioCentavos: item.precio_centavos,
        fotoUrl: item.foto_url,
        alergenos: alergenosDe(item.id).map((a) => a.nombre)
      }))
    }));
  }

  return {
    listarAlergenos: () => db.prepare('SELECT * FROM alergenos ORDER BY id').all(),
    crearCategoria,
    editarCategoria,
    categoriasAdmin,
    archivarCategoria,
    restaurarCategoria,
    reordenarCategorias,
    crearPlato,
    editarPlato,
    platosAdmin,
    archivarPlato,
    restaurarPlato,
    reordenarPlatos,
    asignarFoto,
    cartaPublica,
    plato
  };
}
