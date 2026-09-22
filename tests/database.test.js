import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ALERGENOS } from '../src/server/database.js';
import { testApp } from './helpers.js';

describe('Repositorio del catálogo', () => {
  let context;
  beforeEach(() => { context = testApp(); });
  afterEach(() => context.cleanup());

  it('siembra exactamente los 14 alérgenos obligatorios', () => {
    const actual = context.catalogo.listarAlergenos().map((item) => item.nombre);
    expect(actual).toEqual(ALERGENOS);
    expect(actual).toHaveLength(14);
  });

  it('Categoría archivada no se publica', () => {
    const cat = context.catalogo.crearCategoria({ nombre: 'Café' });
    context.catalogo.crearPlato({ categoriaId: cat.id, nombre: 'Americano', descripcion: 'Café filtrado', precioCentavos: 4500 });
    context.catalogo.archivarCategoria(cat.id);
    expect(context.catalogo.cartaPublica()).toEqual([]);
  });

  it('Dueño archiva una categoría', () => {
    const cat = context.catalogo.crearCategoria({ nombre: 'Pan' });
    const dish = context.catalogo.crearPlato({ categoriaId: cat.id, nombre: 'Concha', descripcion: 'Pan dulce', precioCentavos: 3000 });
    context.catalogo.asignarFoto(dish.id, '/media/concha.webp');
    context.catalogo.archivarCategoria(cat.id);
    const archived = context.catalogo.plato(dish.id);
    expect(archived.archivado).toBe(1);
    expect(archived.foto_url).toBe('/media/concha.webp');
  });

  it('Dueño restaura una categoría', () => {
    const cat = context.catalogo.crearCategoria({ nombre: 'Pan' });
    const dish = context.catalogo.crearPlato({ categoriaId: cat.id, nombre: 'Concha', descripcion: 'Pan dulce', precioCentavos: 3000 });
    context.catalogo.archivarCategoria(cat.id);
    context.catalogo.restaurarCategoria(cat.id);
    expect(context.catalogo.plato(dish.id).archivado).toBe(0);
    expect(context.catalogo.cartaPublica()[0].platos[0].nombre).toBe('Concha');
  });

  it('Dueño archiva y restaura un plato', () => {
    const cat = context.catalogo.crearCategoria({ nombre: 'Bebidas' });
    const dish = context.catalogo.crearPlato({ categoriaId: cat.id, nombre: 'Té', descripcion: 'Té negro', precioCentavos: 4200 });
    context.catalogo.asignarFoto(dish.id, '/media/te.webp');
    context.catalogo.archivarPlato(dish.id);
    context.catalogo.restaurarPlato(dish.id);
    expect(context.catalogo.plato(dish.id)).toMatchObject({ archivado: 0, foto_url: '/media/te.webp' });
  });
});
