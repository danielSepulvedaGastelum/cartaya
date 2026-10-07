import express from 'express';

export function abrirEventos(req, res, pedidos) {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache',
    Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  let closed = false;
  let cancelar = () => {};
  let quitarRevocacion = () => {};
  let mantenimiento;
  let vencimiento;
  const cerrar = () => {
    if (closed) return;
    closed = true;
    cancelar();
    quitarRevocacion();
    clearInterval(mantenimiento);
    clearTimeout(vencimiento);
    if (!res.writableEnded) res.end();
  };
  res.once('close', cerrar);
  const enviar = (tipo, data) => {
    if (!closed) res.write(`event: ${tipo}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  quitarRevocacion = req.suscribirRevocacion?.(cerrar) || (() => {});
  if (closed) return;
  cancelar = pedidos.suscribir(({ tipo, ...data }) => enviar(tipo, data));
  mantenimiento = setInterval(() => { if (!closed) res.write(': mantenimiento\n\n'); }, 25000);
  vencimiento = setTimeout(cerrar, Math.max(0, req.sesionExpiraEn - Date.now()));
  enviar('snapshot', pedidos.instantanea());
}

export function createCocina(auth, pedidos) {
  const router = express.Router();
  router.use(auth.requireAdmin);
  router.get('/', (req, res) => res.json({ ...pedidos.instantanea(),
    sesionExpiraEn: new Date(req.sesionExpiraEn).toISOString() }));
  router.get('/eventos', (req, res) => abrirEventos(req, res, pedidos));
  for (const accion of ['iniciar', 'servir', 'cancelar']) {
    router.post(`/pedidos/:numero/${accion}`, (req, res) => res.json(pedidos[accion](req.params.numero)));
  }
  return router;
}
