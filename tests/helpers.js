import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import supertest from 'supertest';
import { createApp } from '../src/server/app.js';

export function testApp() {
  const mediaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cartaya-media-'));
  const context = createApp({
    databasePath: ':memory:',
    mediaDir,
    password: 'cafetera-segura',
    sessionSecret: 'secreto-de-pruebas-largo',
    publicBaseUrl: 'http://localhost:3000',
    mesas: ['uno', 'dos'],
    production: false
  });
  return {
    ...context,
    request: supertest(context.app),
    agent: supertest.agent(context.app),
    cleanup() {
      context.db.close();
      fs.rmSync(mediaDir, { recursive: true, force: true });
    }
  };
}

export async function login(agent) {
  return agent.post('/api/sesion').send({ password: 'cafetera-segura' }).expect(200);
}
