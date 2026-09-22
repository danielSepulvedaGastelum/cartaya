import path from 'node:path';

function loadDotEnv() {
  try {
    process.loadEnvFile?.();
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

export function getConfig(overrides = {}) {
  loadDotEnv();
  const root = process.cwd();
  const mesas = (process.env.MESAS || 'barra,ventana,patio-1,patio-2')
    .split(',')
    .map((mesa) => mesa.trim())
    .filter(Boolean);

  return {
    port: Number(process.env.PORT || 3000),
    password: process.env.ESTABLECIMIENTO_PASSWORD || 'desarrollo-local',
    sessionSecret: process.env.SESSION_SECRET || 'solo-desarrollo-cambiar-en-produccion',
    databasePath: path.resolve(root, process.env.SQLITE_PATH || './data/cartaya.sqlite'),
    mediaDir: path.resolve(root, process.env.MEDIA_DIR || './media'),
    publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:3000',
    mesas,
    production: process.env.NODE_ENV === 'production',
    ...overrides
  };
}
