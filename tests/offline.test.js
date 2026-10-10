'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const APP = path.join(__dirname, '..', 'app');
const read = (f) => fs.readFileSync(path.join(APP, f), 'utf8');

function cachedAssets() {
  const src = read('sw.js');
  const list = src.match(/const ASSETS = \[([\s\S]*?)\];/)[1];
  return [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

test('todo arquivo guardado pelo service worker existe', () => {
  for (const f of cachedAssets()) {
    if (f === './') continue;
    assert.ok(fs.existsSync(path.join(APP, f)), `falta ${f}`);
  }
});

test('o service worker guarda tudo que a página carrega', () => {
  const assets = new Set(cachedAssets());
  const html = read('index.html');
  const refs = [...html.matchAll(/(?:href|src)="([^"#:]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length > 0);
  for (const r of refs) assert.ok(assets.has(r), `${r} não está no cache`);
  for (const m of read('fonts/fonts.css').matchAll(/url\('([^']+)'\)/g)) {
    assert.ok(assets.has(`fonts/${m[1]}`), `fonts/${m[1]} não está no cache`);
  }
  const manifest = JSON.parse(read('manifest.webmanifest'));
  for (const icon of manifest.icons) assert.ok(assets.has(icon.src), `${icon.src} não está no cache`);
});

test('a página não depende de nada fora do próprio app', () => {
  const html = read('index.html');
  assert.ok(!/(?:href|src)="https?:\/\//.test(html), 'index.html carrega algo de fora');
  assert.ok(!/https?:\/\//.test(read('style.css')), 'style.css carrega algo de fora');
  assert.ok(!/https?:\/\//.test(read('fonts/fonts.css')), 'fonts.css carrega algo de fora');
});
