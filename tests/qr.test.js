import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateQrs, mesaToken } from '../src/server/generate-qr.js';

describe('QR local por mesa', () => {
  it('genera un identificador opaco y distinto para cada mesa sin servicio externo', () => {
    const one = mesaToken('mesa-1', 'secreto');
    const two = mesaToken('mesa-2', 'secreto');
    expect(one).not.toBe(two);
    expect(one).not.toContain('mesa-1');
    expect(new URL(`https://carta.local/?mesa=${one}`).searchParams.get('mesa')).toBe(one);
  });

  it('genera localmente un PNG distinto para cada mesa configurada', async () => {
    const output = fs.mkdtempSync(path.join(os.tmpdir(), 'cartaya-qr-'));
    try {
      const generated = await generateQrs({
        mesas: ['barra', 'patio'],
        sessionSecret: 'secreto-local',
        publicBaseUrl: 'https://carta.local'
      }, output);
      expect(generated.map((item) => item.url)).toHaveLength(2);
      expect(new Set(generated.map((item) => item.url)).size).toBe(2);
      expect(generated.every((item) => fs.statSync(item.filename).size > 0)).toBe(true);
    } finally {
      fs.rmSync(output, { recursive: true, force: true });
    }
  });
});
