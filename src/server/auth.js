import crypto from 'node:crypto';

function seguraIgual(a, b) {
  const first = Buffer.from(String(a));
  const second = Buffer.from(String(b));
  return first.length === second.length && crypto.timingSafeEqual(first, second);
}

export function createAuth(config) {
  const sessions = new Map();
  const maxAge = 8 * 60 * 60 * 1000;

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
    sessions.set(token, Date.now() + maxAge);
    res.cookie('cartaya_sesion', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.production,
      maxAge,
      path: '/'
    });
    return res.json({ autenticado: true });
  }

  function logout(req, res) {
    const token = parseCookies(req.headers.cookie).cartaya_sesion;
    if (token) sessions.delete(token);
    res.clearCookie('cartaya_sesion', { httpOnly: true, sameSite: 'lax', secure: config.production, path: '/' });
    res.status(204).end();
  }

  function requireAdmin(req, res, next) {
    const token = parseCookies(req.headers.cookie).cartaya_sesion;
    const expires = token && sessions.get(token);
    if (!expires || expires < Date.now()) {
      if (token) sessions.delete(token);
      return res.status(401).json({ error: 'Se requiere iniciar sesión' });
    }
    next();
  }

  return { login, logout, requireAdmin };
}
