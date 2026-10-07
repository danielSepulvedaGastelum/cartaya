// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CartaPublica } from '../src/client/CartaPublica.jsx';

const carta = { mesa: 'token-valido', mesaValida: true, categorias: [{ id: 1, nombre: 'Comida', platos: [{ id: 1, nombre: 'Torta', descripcion: 'Pan y relleno', precioCentavos: 4500, alergenos: [] }] }] };
const respuesta = (body, ok = true, status = 200) => ({ ok, status, json: async () => body });

describe('Pedido desde la carta publica', () => {
  beforeEach(() => { history.replaceState({}, '', '/?mesa=token-valido'); global.fetch = vi.fn().mockResolvedValue(respuesta(carta)); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
  async function cargar() { render(<CartaPublica />); await screen.findByText('Torta'); }

  it('Cliente ajusta la cantidad desde una tarjeta', async () => {
    await cargar();
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    expect(screen.getByText('Subtotal: $90.00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '−' }));
    expect(screen.getByText('Subtotal: $45.00')).toBeInTheDocument();
  });

  it('Cliente agrega indicaciones distintas o repetidas al mismo plato', async () => {
    await cargar();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar indicaciones' }));
    fireEvent.change(screen.getByLabelText('Indicación (opcional)'), { target: { value: 'sin cebolla' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar indicación' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar indicaciones' }));
    fireEvent.change(screen.getAllByLabelText('Indicación (opcional)')[0], { target: { value: 'sin cebolla' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar indicación' }));
    expect(screen.getAllByDisplayValue('sin cebolla')).toHaveLength(2);
    expect(screen.getByText('Total: $90.00')).toBeInTheDocument();
  });

  it('Cliente edita una indicación desde el resumen', async () => {
    await cargar();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar indicaciones' }));
    fireEvent.change(screen.getByLabelText('Indicación (opcional)'), { target: { value: 'sin cebolla' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar indicación' }));
    fireEvent.change(screen.getByDisplayValue('sin cebolla'), { target: { value: 'sin azúcar' } });
    expect(screen.getByDisplayValue('sin azúcar')).toBeInTheDocument();
  });
  it('reconcilia precio y total visible antes de un nuevo envio explicito', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(respuesta(carta)).mockImplementationOnce((_url, options) => {
      const id = JSON.parse(options.body).lineas[0].lineaId;
      return Promise.resolve(respuesta({ tipo: 'precio_modificado', totalCentavos: 5000, noDisponibles: [],
        preciosModificados: [{ lineaId: id, precioCentavos: 5000 }],
        lineas: [{ lineaId: id, platoId: 1, precioCentavos: 5000, cantidad: 1 }] }, false, 409));
    }).mockResolvedValueOnce(respuesta({ numero: 1, estado: 'recibido', totalCentavos: 5000 }));
    await cargar(); fireEvent.click(screen.getByRole('button', { name: '+' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    await screen.findByText('Total: $50.00');
    expect(screen.getByText('Subtotal: $50.00')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    await screen.findByRole('heading', { name: 'Pedido confirmado' });
    expect(global.fetch).toHaveBeenCalledTimes(3);
    const primero = JSON.parse(global.fetch.mock.calls[1][1].body);
    const segundo = JSON.parse(global.fetch.mock.calls[2][1].body);
    expect(primero.claveIdempotencia).not.toBe(segundo.claveIdempotencia);
    expect(segundo.lineas[0].precioCentavos).toBe(5000);
  });

  it('conserva exactamente el intento cuando se pierde la respuesta', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(respuesta(carta))
      .mockRejectedValueOnce(new TypeError('red perdida'))
      .mockResolvedValueOnce(respuesta({ numero: 4, estado: 'recibido', totalCentavos: 4500 }));
    await cargar(); fireEvent.click(screen.getByRole('button', { name: '+' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    const retry = await screen.findByRole('button', { name: /Reintentar el mismo/ });
    expect(screen.getByRole('button', { name: '+' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeDisabled();
    expect(screen.getByLabelText('Indicaci\u00f3n (opcional)')).toBeDisabled();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    fireEvent.click(retry);
    await screen.findByRole('heading', { name: 'Pedido confirmado' });
    expect(global.fetch.mock.calls[1][1].body).toBe(global.fetch.mock.calls[2][1].body);
  });

  it('requiere una nueva confirmacion para el segundo pedido', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(respuesta(carta))
      .mockResolvedValueOnce(respuesta({ numero: 1, estado: 'recibido', totalCentavos: 4500 }))
      .mockResolvedValueOnce(respuesta(carta))
      .mockResolvedValueOnce(respuesta({ numero: 2, estado: 'recibido', totalCentavos: 4500 }));
    await cargar(); fireEvent.click(screen.getByRole('button', { name: '+' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    await screen.findByText(/N\u00famero 1/);
    fireEvent.click(screen.getByRole('button', { name: 'Hacer otro pedido' }));
    await screen.findByText(/A\u00fan no agregas platos/);
    expect(global.fetch).toHaveBeenCalledTimes(3);
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    expect(global.fetch).toHaveBeenCalledTimes(3);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    await screen.findByText(/N\u00famero 2/);
    expect(JSON.parse(global.fetch.mock.calls[1][1].body).claveIdempotencia)
      .not.toBe(JSON.parse(global.fetch.mock.calls[3][1].body).claveIdempotencia);
  });

  it('convierte una linea normal con nota en independiente sin fusionarla', async () => {
    await cargar(); fireEvent.click(screen.getByRole('button', { name: '+' }));
    const nota = screen.getByLabelText('Indicaci\u00f3n (opcional)');
    fireEvent.change(nota, { target: { value: 'sin cebolla' } });
    fireEvent.click(screen.getAllByRole('button', { name: '+' })[0]);
    expect(screen.getAllByLabelText('Indicaci\u00f3n (opcional)')).toHaveLength(2);
    expect(screen.getByDisplayValue('sin cebolla')).toBeInTheDocument();
    expect(screen.getByText('Total: $90.00')).toBeInTheDocument();
    expect(screen.getByText(/No incluyas datos personales en las indicaciones/)).toBeInTheDocument();
  });

  it('retira una linea y actualiza el precio de otra en un mismo conflicto', async () => {
    const dosPlatos = { ...carta, categorias: [{ ...carta.categorias[0], platos: [...carta.categorias[0].platos,
      { id: 2, nombre: 'Cafe', descripcion: 'Taza', precioCentavos: 3000, alergenos: [] }] }] };
    global.fetch = vi.fn().mockResolvedValueOnce(respuesta(dosPlatos)).mockImplementationOnce((_url, options) => {
      const [a, b] = JSON.parse(options.body).lineas;
      return Promise.resolve(respuesta({ tipo: 'no_disponible', totalCentavos: 3500,
        noDisponibles: [{ lineaId: a.lineaId, platoId: 1, nombre: 'Torta', motivo: 'agotado temporalmente' }],
        preciosModificados: [{ lineaId: b.lineaId, precioCentavos: 3500 }],
        lineas: [{ lineaId: b.lineaId, platoId: 2, precioCentavos: 3500, cantidad: 1 }] }, false, 409));
    });
    render(<CartaPublica />); await screen.findByRole('heading', { name: 'Torta' });
    screen.getAllByRole('button', { name: '+' }).forEach((button) => fireEvent.click(button));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    await screen.findByText('Total: $35.00');
    expect(screen.queryByRole('heading', { name: 'Torta' })).not.toBeInTheDocument();
    expect(screen.getByText('Subtotal: $35.00')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('acepta 140 caracteres y rechaza 141 con aviso sin cambiar la nota', async () => {
    await cargar(); fireEvent.click(screen.getByRole('button', { name: '+' }));
    const nota = screen.getByLabelText('Indicaci\u00f3n (opcional)');
    fireEvent.change(nota, { target: { value: 'x'.repeat(140) } });
    expect(nota).toHaveValue('x'.repeat(140));
    fireEvent.change(nota, { target: { value: 'x'.repeat(141) } });
    expect(nota).toHaveValue('x'.repeat(140));
    expect(screen.getByRole('status')).toHaveTextContent('140 caracteres');
    fireEvent.change(nota, { target: { value: '' } });
    expect(nota).toHaveValue('');
  });

  it('conserva confirmacion si falla la consulta para otro pedido', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(respuesta(carta))
      .mockResolvedValueOnce(respuesta({ numero: 1, estado: 'recibido', totalCentavos: 4500 }))
      .mockRejectedValueOnce(new TypeError('sin red')).mockResolvedValueOnce(respuesta({ ...carta, mesaValida: false, mesaInactiva: true }));
    await cargar(); fireEvent.click(screen.getByRole('button', { name: '+' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    await screen.findByRole('heading', { name: 'Pedido confirmado' });
    fireEvent.click(screen.getByRole('button', { name: 'Hacer otro pedido' }));
    await screen.findByText(/No se pudo actualizar la carta/);
    expect(screen.getByText(/N\u00famero 1/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hacer otro pedido' }));
    await screen.findByText(/Esta mesa ya no acepta pedidos/);
    expect(screen.queryByRole('button', { name: 'Confirmar pedido' })).not.toBeInTheDocument();
  });

  it('respuesta incompleta y 5xx conservan el intento para reintento manual', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(respuesta(carta))
      .mockResolvedValueOnce(respuesta({ numero: 1 }))
      .mockResolvedValueOnce(respuesta({ error: 'fallo transitorio' }, false, 503))
      .mockResolvedValueOnce(respuesta({ numero: 1, estado: 'recibido', totalCentavos: 4500 }));
    await cargar(); fireEvent.click(screen.getByRole('button', { name: '+' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    await screen.findByRole('button', { name: /Reintentar el mismo/ });
    fireEvent.click(screen.getByRole('button', { name: /Reintentar el mismo/ }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
    expect(screen.getByRole('button', { name: /Reintentar el mismo/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Reintentar el mismo/ }));
    await screen.findByRole('heading', { name: 'Pedido confirmado' });
    expect(global.fetch.mock.calls[1][1].body).toBe(global.fetch.mock.calls[2][1].body);
    expect(global.fetch.mock.calls[2][1].body).toBe(global.fetch.mock.calls[3][1].body);
  });

  it('elimina lineas del resumen y no ofrece pedido sin mesa identificada', async () => {
    await cargar(); fireEvent.click(screen.getByRole('button', { name: '+' }));
    expect(screen.getByText('Total: $45.00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(screen.getByText('Total: $0.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar pedido' })).toBeDisabled();
    cleanup(); global.fetch = vi.fn().mockResolvedValue(respuesta({ ...carta, mesaValida: false }));
    history.replaceState({}, '', '/'); render(<CartaPublica />);
    await screen.findByRole('heading', { name: 'Torta' });
    expect(screen.queryByRole('button', { name: 'Confirmar pedido' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+' })).not.toBeInTheDocument();
  });

  it('selector respeta cero, uno y veinte sin permitir veintiuno', async () => {
    await cargar();
    const agregar = screen.getByRole('button', { name: '+' });
    fireEvent.click(agregar);
    expect(screen.getByText('Subtotal: $45.00')).toBeInTheDocument();
    for (let i = 1; i < 20; i++) fireEvent.click(agregar);
    expect(screen.getByText('Subtotal: $900.00')).toBeInTheDocument();
    expect(agregar).toBeDisabled();
    expect(screen.getByText('El m\u00e1ximo es 20 unidades por l\u00ednea')).toBeInTheDocument();
    for (let i = 0; i < 20; i++) fireEvent.click(screen.getAllByRole('button', { name: '\u2212' })[0]);
    expect(screen.getByText('Subtotal: $0.00')).toBeInTheDocument();
  });

  it('guarda una linea independiente sin nota y no la fusiona al vaciar otra', async () => {
    await cargar(); fireEvent.click(screen.getByRole('button', { name: '+' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar indicaciones' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar indicaci\u00f3n' }));
    expect(screen.getAllByLabelText('Indicaci\u00f3n (opcional)')).toHaveLength(2);
    fireEvent.change(screen.getAllByLabelText('Indicaci\u00f3n (opcional)')[0], { target: { value: 'sin sal' } });
    fireEvent.change(screen.getByDisplayValue('sin sal'), { target: { value: '' } });
    expect(screen.getAllByLabelText('Indicaci\u00f3n (opcional)')).toHaveLength(2);
    expect(screen.getByText('Total: $90.00')).toBeInTheDocument();
  });

  it('doble toque inmediato en confirmar solo envia una solicitud', async () => {
    let resolver;
    global.fetch = vi.fn().mockResolvedValueOnce(respuesta(carta))
      .mockImplementationOnce(() => new Promise((resolve) => { resolver = resolve; }));
    await cargar(); fireEvent.click(screen.getByRole('button', { name: '+' }));
    const confirmar = screen.getByRole('button', { name: 'Confirmar pedido' });
    fireEvent.click(confirmar); fireEvent.click(confirmar);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    resolver(respuesta({ numero: 1, estado: 'recibido', totalCentavos: 4500 }));
    await screen.findByRole('heading', { name: 'Pedido confirmado' });
  });

  it('el flujo publico solo ofrece componer y confirmar sin cuenta ni cocina', async () => {
    await cargar();
    expect(screen.getByRole('heading', { name: 'Tu pedido' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar pedido' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Contrase\u00f1a')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Administrar|Cocina/ })).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toMatch(/^\/api\/carta/);
  });

});


