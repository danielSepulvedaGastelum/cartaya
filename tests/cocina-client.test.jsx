// @vitest-environment jsdom
import React from 'react';
import fs from 'node:fs';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axe from 'axe-core';
import { Cocina } from '../src/client/Cocina.jsx';
import { App } from '../src/client/App.jsx';

const base = new Date('2026-09-23T17:00:00Z').getTime();
function pedido(numero, extra = {}) {
  return { numero, mesa: 'Patio', estado: 'recibido', creadoEn: new Date(base - 60000).toISOString(),
    enPreparacionEn: null, servidoEn: null, canceladoEn: null,
    lineas: [{ id: numero * 10, nombre: 'Torta', cantidad: 2, nota: 'Sin cebolla' },
      { id: numero * 10 + 1, nombre: 'Café', cantidad: 1, nota: null }], ...extra };
}
function snapshot(extra = {}) { return { recibidos: [], enPreparacion: [], servidos: [], cancelados: [],
  sesionExpiraEn: new Date(base + 3600000).toISOString(), ...extra }; }
const respuesta = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
let streams, audio, fetchMock, style;
class Stream {
  constructor(url) { this.url = url; this.listeners = {}; this.close = vi.fn(); streams.push(this); }
  addEventListener(tipo, fn) { this.listeners[tipo] = fn; }
  emitir(tipo, data) { act(() => this.listeners[tipo]({ data: JSON.stringify(data) })); }
  error() { act(() => this.onerror()); }
}
async function abrir(data = snapshot({ recibidos: [pedido(1)] }), component = <Cocina />) {
  fetchMock.mockResolvedValue(respuesta(data));
  const resultado = render(component);
  await screen.findByRole('navigation', { name: 'Estados de pedidos' });
  return resultado;
}
function region(nombre) { return within(screen.getByRole('region', { name: nombre })); }

describe('Panel de cocina', () => {
  beforeEach(() => {
    streams = []; vi.spyOn(Date, 'now').mockReturnValue(base);
    fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); vi.stubGlobal('EventSource', Stream);
    audio = vi.fn(function () {
      this.state = 'running'; this.currentTime = 0; this.destination = {};
      this.close = vi.fn().mockResolvedValue();
      this.createGain = () => ({ gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} });
      this.createOscillator = () => ({ frequency: {}, connect() {}, start() {}, stop() { this.onended(); } });
    });
    vi.stubGlobal('AudioContext', audio); vi.spyOn(window, 'confirm').mockReturnValue(true);
    style = document.createElement('style'); style.textContent = fs.readFileSync('src/client/styles.css', 'utf8'); document.head.append(style);
  });
  afterEach(() => { cleanup(); style.remove(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); history.replaceState({}, '', '/'); });

  it('Sesión del establecimiento abre el panel', async () => {
    history.replaceState({}, '', '/cocina'); await abrir(undefined, <App />);
    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1); expect(fetchMock.mock.calls[0][0]).toBe('/api/cocina');
    expect(streams[0].url).toBe('/api/cocina/eventos');
  });
  it('Persona sin sesión intenta consultar el panel', async () => {
    fetchMock.mockResolvedValueOnce(respuesta({ error: 'Se requiere iniciar sesión' }, 401)); render(<Cocina />);
    expect(await screen.findByLabelText('Contraseña')).toBeInTheDocument(); expect(streams).toHaveLength(0);
    fetchMock.mockResolvedValueOnce(respuesta({ autenticado: true })).mockResolvedValueOnce(respuesta(snapshot({ recibidos: [pedido(1)] })));
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'clave' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await screen.findByRole('navigation');
    expect(fetchMock.mock.calls[1]).toEqual(['/api/sesion', expect.objectContaining({ method: 'POST', body: '{"password":"clave"}' })]);
  });
  it('Sesión cubre la jornada completa', async () => {
    await abrir(snapshot({ recibidos: [pedido(1)], sesionExpiraEn: new Date(base + 1000).toISOString() }));
    // Reabrir bajo temporizadores controlados para comprobar el límite exacto.
    cleanup(); streams = []; vi.useFakeTimers(); vi.setSystemTime(base);
    render(<Cocina />); await act(async () => {});
    await act(async () => vi.advanceTimersByTime(999)); expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument();
    await act(async () => vi.advanceTimersByTime(1)); expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(streams[0].close).toHaveBeenCalled();
    streams[0].emitir('pedido_nuevo', snapshot({ recibidos: [pedido(99)], numero: 99 }));
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument(); expect(audio).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(respuesta({ autenticado: true })).mockResolvedValueOnce(respuesta(snapshot({ recibidos: [pedido(1)], sesionExpiraEn: new Date(base + 86400000).toISOString() })));
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'clave' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Entrar' })));
    expect(screen.getByRole('heading', { name: 'Pedido #1 · Mesa Patio' })).toBeInTheDocument();
  });
  it('Panel utilizable en tablet', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 768 });
    const { container } = await abrir();
    expect(getComputedStyle(container.querySelector('.cocina')).fontSize).toBe('18px');
    for (const control of container.querySelectorAll('button, nav a')) expect(parseFloat(getComputedStyle(control).minHeight)).toBeGreaterThanOrEqual(48);
    expect(getComputedStyle(container.querySelector('.cocina')).color).toBe('rgb(23, 33, 30)');
    expect(getComputedStyle(container.querySelector('nav a')).backgroundColor).toBe('rgb(21, 62, 54)');
    expect((await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })).violations).toEqual([]);
  });
  it('Cocina navega entre todos los estados operativos', async () => {
    await abrir();
    for (const [id, titulo] of [['recibidos', 'Recibidos'], ['enPreparacion', 'En preparación'], ['servidos', 'Servidos'], ['cancelados', 'Cancelados']]) {
      const enlace = screen.getByRole('link', { name: new RegExp('^' + titulo) });
      expect(enlace).toHaveAttribute('href', '#' + id); expect(screen.getByRole('region', { name: titulo })).toHaveAttribute('id', id);
    }
  });
  it('Cocina consulta pedidos activos ordenados', async () => {
    await abrir(snapshot({ recibidos: [pedido(2), pedido(1)] }));
    expect(region('Recibidos').getAllByRole('article').map((a) => within(a).getByRole('heading').textContent))
      .toEqual(['Pedido #1 · Mesa Patio', 'Pedido #2 · Mesa Patio']);
    expect(screen.getAllByText('2 × Torta')).toHaveLength(2); expect(screen.getAllByText('Nota: Sin cebolla')).toHaveLength(2);
    expect(screen.getAllByText('1 min desde la confirmación')).toHaveLength(2);
    expect(screen.getAllByText('Recibido', { exact: true })).toHaveLength(2);
  });
  it('Cocina consulta el histórico del día', async () => {
    const servido = (n) => pedido(n, { estado: 'servido', enPreparacionEn: new Date(base - 30000).toISOString(), servidoEn: new Date(base).toISOString() });
    await abrir(snapshot({ servidos: [servido(1), servido(2)], cancelados: [pedido(3, { canceladoEn: new Date(base).toISOString() })] }));
    expect(region('Servidos').getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Pedido #2 · Mesa Patio', 'Pedido #1 · Mesa Patio']);
    expect(region('Servidos').getAllByText(/^Preparación:/)).toHaveLength(2); expect(region('Servidos').getAllByText(/^Servido:/)).toHaveLength(2);
    expect(region('Cancelados').getByText(/^Cancelado:/)).toBeInTheDocument();
    expect(region('Cancelados').getByText('Cancelado · Preparación: Recibido')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it('Bebidas y alimentos avanzan juntos', async () => {
    await abrir(); fireEvent.click(screen.getByRole('button', { name: 'Iniciar preparación' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(window.confirm).not.toHaveBeenCalled();
    const p = pedido(1, { estado: 'en_preparacion', enPreparacionEn: new Date(base).toISOString() });
    streams[0].emitir('pedidos_actualizados', snapshot({ enPreparacion: [p], numero: 1 }));
    expect(region('En preparación').getByText('2 × Torta')).toBeInTheDocument(); expect(region('En preparación').getByText('1 × Café')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Servir pedido' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[2][0]).toBe('/api/cocina/pedidos/1/servir');
  });
  it('Tiempo transcurrido avanza sin polling', async () => {
    vi.useFakeTimers(); vi.setSystemTime(base); fetchMock.mockResolvedValue(respuesta(snapshot({ recibidos: [pedido(1)] })));
    render(<Cocina />); await act(async () => {}); expect(screen.getByText('1 min desde la confirmación')).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTime(60000)); expect(screen.getByText('2 min desde la confirmación')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    cleanup(); expect(vi.getTimerCount()).toBe(0); expect(streams[0].close).toHaveBeenCalledOnce();
  });
  it('Cocina no confirma que el pedido fue servido', async () => {
    window.confirm.mockReturnValue(false); await abrir(snapshot({ enPreparacion: [pedido(1, { estado: 'en_preparacion' })] }));
    fireEvent.click(screen.getByRole('button', { name: 'Servir pedido' })); expect(window.confirm).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(1); expect(region('En preparación').getByRole('article')).toBeInTheDocument();
  });
  it('Cocina no confirma la cancelación', async () => {
    window.confirm.mockReturnValue(false); await abrir(); fireEvent.click(screen.getByRole('button', { name: 'Cancelar pedido' }));
    expect(window.confirm).toHaveBeenCalledOnce(); expect(fetchMock).toHaveBeenCalledTimes(1); expect(region('Recibidos').getByRole('article')).toBeInTheDocument();
  });
  it('Cancelar confirmado no solicita motivo', async () => {
    await abrir(); fireEvent.click(screen.getByRole('button', { name: 'Cancelar pedido' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]).toEqual(['/api/cocina/pedidos/1/cancelar', expect.objectContaining({ method: 'POST' })]);
    expect(fetchMock.mock.calls[1][1].body).toBeUndefined(); expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
  it('Pedido confirmado aparece solo', async () => {
    await abrir(snapshot()); streams[0].emitir('snapshot', snapshot());
    const data = snapshot({ recibidos: [pedido(2), pedido(1), pedido(1)], numero: 2 });
    streams[0].emitir('pedido_nuevo', data); streams[0].emitir('pedido_nuevo', data);
    expect(region('Recibidos').getAllByRole('article')).toHaveLength(2); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('Cambio de pedido se refleja en otros paneles', async () => {
    await abrir(); streams[0].emitir('pedidos_actualizados', snapshot({ enPreparacion: [pedido(1, { estado: 'en_preparacion' })] }));
    expect(region('Recibidos').queryByRole('article')).not.toBeInTheDocument(); expect(region('En preparación').getAllByRole('article')).toHaveLength(1);
    streams[0].emitir('pedidos_actualizados', snapshot({ cancelados: [pedido(1, { canceladoEn: new Date(base).toISOString() })] }));
    expect(region('Cancelados').getAllByRole('article')).toHaveLength(1); expect(audio).not.toHaveBeenCalled();
  });
  it('Panel avisa mientras está desconectado', async () => {
    await abrir(); streams[0].error(); expect(screen.getByRole('alert')).toHaveTextContent('Sin conexión');
    act(() => streams[0].onopen?.()); expect(screen.getByRole('alert')).toBeInTheDocument();
    streams[0].emitir('pedidos_actualizados', snapshot()); expect(screen.getByRole('alert')).toBeInTheDocument();
    streams[0].emitir('snapshot', snapshot()); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('Panel se recupera de una desconexión', async () => {
    await abrir(); streams[0].error();
    const data = snapshot({ recibidos: [pedido(2), pedido(2)], servidos: [pedido(1, { estado: 'servido', servidoEn: new Date(base).toISOString() })] });
    streams[0].emitir('snapshot', data); streams[0].emitir('snapshot', data);
    expect(region('Recibidos').getAllByRole('article')).toHaveLength(1); expect(region('Servidos').getAllByRole('article')).toHaveLength(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument(); expect(audio).toHaveBeenCalledOnce();
  });
  it('Llega un pedido después de abrir el panel', async () => {
    await abrir(); streams[0].emitir('snapshot', snapshot({ recibidos: [pedido(1)] })); expect(audio).not.toHaveBeenCalled();
    const data = snapshot({ recibidos: [pedido(1), pedido(2)], numero: 2 });
    streams[0].emitir('pedido_nuevo', data); streams[0].emitir('pedido_nuevo', data);
    streams[0].emitir('pedidos_actualizados', data); expect(audio).toHaveBeenCalledOnce();
  });
  it('Reconexión recupera un pedido no visto', async () => {
    await abrir(); streams[0].error();
    const data = snapshot({ recibidos: [pedido(1), pedido(2)], enPreparacion: [pedido(3, { estado: 'en_preparacion' })] });
    streams[0].emitir('snapshot', data); streams[0].error(); streams[0].emitir('snapshot', data);
    expect(audio).toHaveBeenCalledTimes(2); expect(screen.getAllByRole('article')).toHaveLength(3);
  });
  it('El navegador bloquea el aviso sonoro', async () => {
    audio.mockImplementation(function () { this.state = 'suspended'; this.resume = () => Promise.reject(Error('Bloqueado')); this.close = () => Promise.resolve(); });
    await abrir(snapshot()); streams[0].emitir('pedido_nuevo', snapshot({ recibidos: [pedido(1)], numero: 1 }));
    await act(async () => {}); expect(screen.getByRole('button', { name: 'Iniciar preparación' })).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('Un 401 al operar o reconectar vuelve al acceso', async () => {
    await abrir(); fetchMock.mockResolvedValue(respuesta({ error: 'Sesión vencida' }, 401));
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar preparación' }));
    await screen.findByLabelText('Contraseña'); expect(streams[0].close).toHaveBeenCalled();
    cleanup(); streams = []; await abrir(); fetchMock.mockResolvedValue(respuesta({ error: 'Sesión vencida' }, 401));
    streams[0].error(); await screen.findByLabelText('Contraseña'); expect(streams[0].close).toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: /Pedido #1/ })).not.toBeInTheDocument();
    fetchMock.mockResolvedValueOnce(respuesta({ autenticado: true })).mockResolvedValueOnce(respuesta(snapshot({ recibidos: [pedido(7)] })));
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'clave' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await screen.findByRole('heading', { name: /Pedido #7/ });
    expect(streams).toHaveLength(2);
  });
});
