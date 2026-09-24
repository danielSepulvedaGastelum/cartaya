export function preparar(context) {
  const categoria = context.catalogo.crearCategoria({ nombre: 'Comida' });
  const plato = context.catalogo.crearPlato({ categoriaId: categoria.id, nombre: 'Torta', descripcion: 'Pan', precioCentavos: 4500 });
  let clave = 0;
  const datos = () => ({ mesa: context.mesas.lista()[0].token, claveIdempotencia: String(++clave),
    lineas: [{ platoId: plato.id, cantidad: 2, nota: 'Sin cebolla', precioCentavos: 4500 }] });
  return { datos, nuevo: () => context.pedidos.confirmar(datos()).pedido };
}

