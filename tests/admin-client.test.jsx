// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  it('muestra administracion legible y distingue agotamiento temporal', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({
      categorias: [{ id: 1, nombre: 'Cafe', orden: 0, archivada: 0 }],
      platos: [{ id: 1, categoria_id: 1, nombre: 'Americano', precio_centavos: 4500, orden: 0,
        archivado: 0, agotado_temporalmente: 1, alergenos: [] }], alergenos: []
    }) });
    render(<Admin />);
    expect(await screen.findByText('Agotado temporalmente')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disponible' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Categor\u00edas' })).toBeInTheDocument();
  });

  it('navega por Mesas, respeta cancelar, y permite desactivar, reactivar e historial', async () => {
    let mesa = { id: 1, nombre: 'Patio', activa: true, token: 'qr-opaco', url: 'http://localhost/?mesa=qr-opaco' };
    global.fetch = vi.fn(async (url) => {
      if (url === '/api/admin/catalogo') return { ok: true, status: 200, json: async () => ({ categorias: [], platos: [], alergenos: [] }) };
      if (url === '/api/admin/mesas') return { ok: true, status: 200, json: async () => ({ mesas: [mesa] }) };
      if (url.endsWith('/historial')) return { ok: true, status: 200, json: async () => ({ pedidos: [{ numero: 7, totalCentavos: 4500 }] }) };
      if (url.endsWith('/desactivar')) mesa = { ...mesa, activa: false };
      if (url.endsWith('/reactivar')) mesa = { ...mesa, activa: true };
      return { ok: true, status: 200, json: async () => mesa };
    });
    const confirmar = vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    render(<Admin />); await screen.findByRole('heading', { name: 'Administrar carta' });
    fireEvent.click(screen.getByRole('button', { name: 'Mesas' }));
    await screen.findByText('Patio');
    expect(screen.getByRole('link', { name: 'Descargar QR' })).toHaveAttribute('href', '/api/admin/mesas/1/qr?descargar=1');
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
    expect(global.fetch.mock.calls.some(([url]) => url.endsWith('/desactivar'))).toBe(false);
    confirmar.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
    await screen.findByText('Inactiva');
    fireEvent.click(screen.getByRole('button', { name: 'Reactivar' }));
    await waitFor(() => expect(screen.getByText('Activa')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Ver historial' }));
    await screen.findByText('Pedido 7: $45.00');
    fireEvent.click(screen.getByRole('button', { name: 'Renombrar' }));
    expect(screen.getByLabelText('Nombre de la mesa')).toHaveValue('Patio');
    fireEvent.click(screen.getByRole('button', { name: 'Productos' }));
    expect(screen.getByRole('heading', { name: 'Platos' })).toBeInTheDocument();
  });

  it('archiva y restaura categoria y plato desde Productos', async () => {
    let categoria = { id: 1, nombre: 'Cafe', orden: 0, archivada: 0 };
    let plato = { id: 1, categoria_id: 1, nombre: 'Americano', descripcion: 'Taza', precio_centavos: 4500,
      orden: 0, archivado: 0, archivado_por_categoria: 0, agotado_temporalmente: 0, alergenos: [] };
    global.fetch = vi.fn(async (url) => {
      if (url.endsWith('/categorias/1/archivar')) { categoria = { ...categoria, archivada: 1 }; plato = { ...plato, archivado: 1, archivado_por_categoria: 1 }; }
      if (url.endsWith('/categorias/1/restaurar')) { categoria = { ...categoria, archivada: 0 }; plato = { ...plato, archivado: 0, archivado_por_categoria: 0 }; }
      if (url.endsWith('/platos/1/archivar')) plato = { ...plato, archivado: 1 };
      if (url.endsWith('/platos/1/restaurar')) plato = { ...plato, archivado: 0 };
      const body = url === '/api/admin/catalogo' ? { categorias: [categoria], platos: [plato], alergenos: [] } :
        url === '/api/admin/mesas' ? { mesas: [] } : plato;
      return { ok: true, status: 200, json: async () => body };
    });
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    render(<Admin />); await screen.findByText('Americano');
    const filaCategoria = () => screen.getAllByText('Cafe')[0].closest('li');
    const filaPlato = () => screen.getByText('Americano').closest('li');
    fireEvent.click(within(filaCategoria()).getByRole('button', { name: 'Archivar' }));
    await waitFor(() => expect(within(filaCategoria()).getByRole('button', { name: 'Restaurar' })).toBeInTheDocument());
    fireEvent.click(within(filaCategoria()).getByRole('button', { name: 'Restaurar' }));
    await waitFor(() => expect(within(filaCategoria()).getByRole('button', { name: 'Archivar' })).toBeInTheDocument());
    expect(globalThis.confirm).toHaveBeenCalled();
    fireEvent.click(within(filaPlato()).getByRole('button', { name: 'Archivar' }));
    await waitFor(() => expect(within(filaPlato()).getByRole('button', { name: 'Restaurar' })).toBeInTheDocument());
    fireEvent.click(within(filaPlato()).getByRole('button', { name: 'Restaurar' }));
    await waitFor(() => expect(within(filaPlato()).getByRole('button', { name: 'Archivar' })).toBeInTheDocument());
  });

});
