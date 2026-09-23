// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CartaPublica } from '../src/client/CartaPublica.jsx';

describe('Presupuesto mÃ³vil de rendimiento', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('Consulta mÃ³vil con condiciones objetivo: texto Ãºtil en menos de dos segundos y foto diferida sin solicitar', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    Object.defineProperty(navigator, 'connection', { configurable: true, value: { effectiveType: '4g', downlink: 4, rtt: 150 } });
    let observe;
    global.IntersectionObserver = class {
      constructor(callback) { observe = callback; }
      observe() {}
      disconnect() {}
    };
    global.fetch = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          mesa: 'mesa-rendimiento',
          categorias: [{ id: 1, nombre: 'CafÃ©', platos: [
            { id: 1, nombre: 'Americano', descripcion: 'CafÃ© de la casa', precioCentavos: 4500, fotoUrl: null, alergenos: [] },
            { id: 2, nombre: 'Capuchino', descripcion: 'Espuma de leche', precioCentavos: 6000, fotoUrl: '/media/capuchino.webp', alergenos: ['Leche'] }
          ] }]
        })
      };
    });
    const started = performance.now();
    render(<CartaPublica />);
    await screen.findByText('Americano', {}, { timeout: 1900 });
    expect(performance.now() - started).toBeLessThan(2000);
    expect(screen.getByText('Capuchino')).toBeInTheDocument();
    expect(screen.queryByAltText('FotografÃ­a de Capuchino')).not.toBeInTheDocument();
  });
});
