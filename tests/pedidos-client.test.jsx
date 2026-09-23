// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CartaPublica } from '../src/client/CartaPublica.jsx';

const carta = {
  mesa: 'token-valido',
  mesaValida: true,
  categorias: [{ id: 1, nombre: 'Comida', platos: [
    { id: 1, nombre: 'Torta', descripcion: 'Pan y relleno', precioCentavos: 4500, alergenos: [] }
  ] }]
};

function respuesta(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

describe('Pedido desde la carta publica', () => {
  beforeEach(() => {
    history.replaceState({}, '', '/?mesa=token-valido');
    global.fetch = vi.fn().mockResolvedValue(respuesta(carta));
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  async function agregar() {
    render(<CartaPublica />);
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar al pedido' }));
  }

  it('Cliente añade un plato con cantidad y nota', async () => {
    await agregar();
    fireEvent.change(screen.getByLabelText('Cantidad de Torta'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Indicaciones de Torta'), { target: { value: 'sin cebolla' } });
    expect(screen.getByDisplayValue('sin cebolla')).toBeInTheDocument();
    expect(screen.getByText('Total: $90.00')).toBeInTheDocument();
  });

  it('Cliente actualiza o elimina una línea', async () => {
    await agregar();
    fireEvent.change(screen.getByLabelText('Cantidad de Torta'), { target: { value: '3' } });
    expect(screen.getByText('Total: $135.00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(screen.getByText('Aun no agregas platos.')).toBeInTheDocument();
  });

  it('Nota demasiado larga', async () => {
    await agregar();
    fireEvent.change(screen.getByLabelText('Indicaciones de Torta'), { target: { value: 'x'.repeat(141) } });
    expect(screen.getByRole('status')).toHaveTextContent('140 caracteres');
  });

  it('Mismo plato con indicaciones distintas', async () => {
    await agregar();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar al pedido' }));
    const notas = screen.getAllByLabelText('Indicaciones de Torta');
    fireEvent.change(notas[0], { target: { value: 'sin cebolla' } });
    fireEvent.change(notas[1], { target: { value: 'muy picante' } });
    expect(screen.getAllByRole('button', { name: 'Eliminar' })).toHaveLength(2);
  });

  it('Cantidad máxima por línea', async () => {
    await agregar();
    fireEvent.change(screen.getByLabelText('Cantidad de Torta'), { target: { value: '21' } });
    expect(screen.getByRole('status')).toHaveTextContent('entre 1 y 20');
  });

  it('Advertencia de privacidad en la nota', async () => {
    await agregar();
    expect(screen.getByText(/No incluyas datos personales/)).toBeInTheDocument();
  });

  it('Cliente revisa las acciones disponibles del pedido', async () => {
    await agregar();
    expect(screen.queryByText(/propina|pago|camarero|llevar/i)).not.toBeInTheDocument();
  });

  it('Cliente revisa y confirma un pedido', async () => {
    global.fetch.mockResolvedValueOnce(respuesta(carta)).mockResolvedValueOnce(respuesta({ numero: 7, estado: 'recibido', totalCentavos: 4500, lineas: [] }, true, 201));
    await agregar();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    expect(screen.getByRole('button', { name: /Confirm/ })).toBeDisabled();
    await screen.findByRole('heading', { name: 'Pedido confirmado' });
    expect(screen.getByText(/Numero 7.*recibido/)).toBeInTheDocument();
  });

  it('retira una linea ante falta de disponibilidad', async () => {
    global.fetch.mockResolvedValueOnce(respuesta(carta)).mockImplementationOnce(async (_url, opciones) => { const lineaId = JSON.parse(opciones.body).lineas[0].lineaId; return respuesta({ error: 'agotado', tipo: 'no_disponible', noDisponibles: [{ lineaId, nombre: 'Torta' }] }, false, 409); });
    await agregar();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('no disponibles'));
    expect(screen.getByText('Aun no agregas platos.')).toBeInTheDocument();
  });
  it('actualiza el resumen ante cambio de precio', async () => {
    global.fetch.mockResolvedValueOnce(respuesta(carta)).mockResolvedValueOnce(respuesta({ error: 'cambio', tipo: 'precio_modificado', lineas: [{ lineaId: expect.any(String), precioCentavos: 5000 }] }, false, 409));
    await agregar();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('precios cambiaron'));
  });
});




