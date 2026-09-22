// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Admin } from '../src/client/Admin.jsx';

describe('Administración responsive', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('muestra en viewport móvil formularios, alérgenos, foto, orden y archivado', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    history.replaceState({}, '', '/admin');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        categorias: [{ id: 1, nombre: 'Café', orden: 0, archivada: 0 }],
        platos: [{ id: 1, categoria_id: 1, nombre: 'Americano', precio_centavos: 4500, orden: 0, archivado: 0, alergenos: [] }],
        alergenos: [{ id: 1, nombre: 'Leche' }]
      })
    });
    render(<Admin />);
    expect(await screen.findByRole('heading', { name: 'Administrar carta' })).toBeInTheDocument();
    expect(screen.getByLabelText('Precio en MXN')).toHaveAttribute('step', '0.01');
    expect(screen.getByLabelText('Leche')).toBeInTheDocument();
    expect(screen.getByLabelText('Fotografía de Americano')).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
    expect(screen.getAllByRole('button', { name: 'Archivar' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Editar' })).toHaveLength(2);
  });
});
