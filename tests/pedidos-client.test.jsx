// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
});


