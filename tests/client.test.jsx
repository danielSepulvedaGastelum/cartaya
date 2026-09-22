// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axe from 'axe-core';
import { CartaPublica } from '../src/client/CartaPublica.jsx';
import { LazyImage } from '../src/client/LazyImage.jsx';

const carta = {
  mesa: 'opaca',
  categorias: [{
    id: 1,
    nombre: 'Desayunos',
    platos: [
      { id: 1, nombre: 'Chilaquiles', descripcion: 'Con salsa verde', precioCentavos: 8500, fotoUrl: '/media/uno.webp', alergenos: ['Huevo', 'Leche'] },
      { id: 2, nombre: 'Fruta', descripcion: 'Fruta de temporada', precioCentavos: 4250, fotoUrl: '/media/dos.webp', alergenos: [] }
    ]
  }]
};

describe('Interfaz de la carta pública', () => {
  beforeEach(() => {
    history.replaceState({}, '', '/?mesa=opaca');
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => carta });
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); delete global.IntersectionObserver; });

  it('Plato con alérgenos declarados', async () => {
    render(<CartaPublica />);
    const label = await screen.findByText('Alérgenos:');
    expect(label.closest('p')).toHaveTextContent('Huevo, Leche');
  });

  it('Plato sin alérgenos declarados', async () => {
    render(<CartaPublica />);
    await screen.findByText('Fruta');
    expect(screen.getAllByText(/Alérgenos:/)).toHaveLength(1);
  });

  it('Precio con centavos', async () => {
    render(<CartaPublica />);
    expect(await screen.findByText('$85.00')).toBeInTheDocument();
    expect(screen.getByText('$42.50')).toBeInTheDocument();
    expect(screen.queryByText(/IVA/i)).not.toBeInTheDocument();
  });

  it('Fotografía diferida al desplazarse', async () => {
    let callback;
    global.IntersectionObserver = class {
      constructor(fn) { callback = fn; }
      observe() {}
      disconnect() {}
    };
    render(<LazyImage src="/media/diferida.webp" alt="Diferida" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    callback([{ isIntersecting: true }]);
    expect(await screen.findByRole('img')).toHaveAttribute('src', '/media/diferida.webp');
  });

  it('la carta cumple comprobaciones automatizadas de accesibilidad', async () => {
    const { container } = render(<CartaPublica />);
    await screen.findByText('Chilaquiles');
    const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });
});
