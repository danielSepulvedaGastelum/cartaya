import express from 'express';

export function abrirEventos(req, res, pedidos) {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache',
    Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  const enviar = (tipo, data) => res.write(`event: ${tipo}\ndata: ${JSON.stringify(data)}\n\n`);
  const cancelar = pedidos.suscribir(({ tipo, ...data }) => enviar(tipo, data));
  const mantenimiento = setInterval(() => res.write(': mantenimiento\n\n'), 25000);
  const vencimiento = setTimeout(() => res.end(), Math.max(0, req.sesionExpiraEn - Date.now()));
  res.once('close', () => {
    cancelar();
    clearInterval(mantenimiento);
    clearTimeout(vencimiento);
  });
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
