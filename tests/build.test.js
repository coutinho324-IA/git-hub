'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { build } = require('../scripts/build-offline.js');

test('arquivo único não depende de nenhum outro arquivo nem de internet', () => {
  const html = build();
  const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  for (const r of refs) assert.ok(r.startsWith('data:'), `referência externa: ${r}`);
  assert.ok(!/url\((?!data:|#)/.test(html), 'url() apontando para arquivo externo');
  assert.ok(html.includes('KartStrategy'), 'motor de estratégia ausente');
  assert.ok(html.includes('setupOffline'), 'app ausente');
  assert.ok(html.length < 2 * 1024 * 1024, 'arquivo grande demais');
});

test('dist/Box-AJM.html está atualizado (rode npm run build:offline)', () => {
  const dist = fs.readFileSync(path.join(__dirname, '..', 'dist', 'Box-AJM.html'), 'utf8');
  assert.equal(dist, build());
});
