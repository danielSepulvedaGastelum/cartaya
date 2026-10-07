import crypto from 'node:crypto';
import { jornadaLocal } from './jornada.js';

function seguraIgual(a, b) {
  const first = Buffer.from(String(a));
  const second = Buffer.from(String(b));
  return first.length === second.length && crypto.timingSafeEqual(first, second);
}

export function createAuth(config) {
  const sessions = new Map();
  const sessionStreams = new Map();

  function parseCookies(header = '') {
    return Object.fromEntries(header.split(';').filter(Boolean).map((item) => {
      const [key, ...value] = item.trim().split('=');
      return [key, decodeURIComponent(value.join('='))];
    }));
  }

  function login(req, res) {
    if (!seguraIgual(req.body?.password ?? '', config.password)) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }
    const token = crypto.randomBytes(32).toString('base64url');
    const expires = jornadaLocal().fin.getTime();
    sessions.set(token, expires);
    res.cookie('cartaya_sesion', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.production,
      expires: new Date(expires),
      path: '/'
    });
    return res.json({ autenticado: true, sesionExpiraEn: new Date(expires).toISOString() });
  }

  function logout(req, res) {
    const token = parseCookies(req.headers.cookie).cartaya_sesion;
    if (token) {
      sessions.delete(token);
      const streams = sessionStreams.get(token);
      sessionStreams.delete(token);
      if (streams) for (const close of streams) {
        try { close(); } catch { /* Otra conexion debe cerrarse igualmente. */ }
      }
    }
    res.clearCookie('cartaya_sesion', { httpOnly: true, sameSite: 'lax', secure: config.production, path: '/' });
    res.status(204).end();
  }

  function requireAdmin(req, res, next) {
    const token = parseCookies(req.headers.cookie).cartaya_sesion;
    const expires = token && sessions.get(token);
    if (!expires || expires <= Date.now()) {
      if (token) sessions.delete(token);
      return res.status(401).json({ error: 'Se requiere iniciar sesión' });
    }
    req.sesionExpiraEn = expires;
    req.suscribirRevocacion = (close) => {
      if (sessions.get(token) !== expires || expires <= Date.now()) {
        close();
        return () => {};
      }
      let streams = sessionStreams.get(token);
      if (!streams) { streams = new Set(); sessionStreams.set(token, streams); }
      streams.add(close);
      return () => {
        streams.delete(close);
        if (!streams.size) sessionStreams.delete(token);
      };
    };
    next();
  }

  return { login, logout, requireAdmin };
}
