#!/usr/bin/env node
/*
 * Gera um único arquivo HTML com o app inteiro (CSS, JS, fontes e ícone
 * embutidos) para guardar no celular e abrir sem internet.
 *
 * Uso: npm run build:offline            -> dist/Box-AJM.html
 *      node scripts/build-offline.js X  -> grava em X
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const APP = path.join(__dirname, '..', 'app');
const read = (f) => fs.readFileSync(path.join(APP, f), 'utf8');
const b64 = (f) => fs.readFileSync(path.join(APP, f)).toString('base64');

function build() {
  const fontsCss = read('fonts/fonts.css').replace(
    /url\('([^']+)'\)/g,
    (_, file) => `url(data:font/woff2;base64,${b64(`fonts/${file}`)})`
  );
  const css = `${fontsCss}\n${read('style.css')}`;
  const js = `${read('strategy.js')}\n${read('app.js')}`;

  const steps = [
    [/<link rel="manifest"[^>]*>\n/, () => ''],
    [/<link rel="apple-touch-icon"[^>]*>\n/, () => ''],
    [/<link rel="icon"[^>]*>/, () => `<link rel="icon" href="data:image/svg+xml;base64,${b64('icons/icon.svg')}">`],
    [/<link rel="stylesheet" href="fonts\/fonts.css">\n/, () => ''],
    [/<link rel="stylesheet" href="style.css">/, () => `<style>\n${css}\n</style>`],
    [/<script src="strategy.js"><\/script>\n/, () => ''],
    [/<script src="app.js"><\/script>/, () => `<script>\n${js}\n</script>`],
  ];
  let html = read('index.html');
  for (const [re, fn] of steps) {
    if (!re.test(html)) throw new Error(`build-offline: não achei ${re} em app/index.html`);
    html = html.replace(re, fn);
  }
  return html;
}

module.exports = { build };

if (require.main === module) {
  const out = process.argv[2] || path.join(__dirname, '..', 'dist', 'Box-AJM.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const html = build();
  fs.writeFileSync(out, html);
  console.log(`${path.relative(process.cwd(), out)} (${Math.round(html.length / 1024)} KB)`);
}
