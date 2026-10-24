'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { findAngularOutput, findSpringBootJar, stageBuild } = require('../scripts/stage.cjs');

test('copia Angular y JAR sin alterar sus carpetas de compilacion', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xodoprinter-stage-'));
  try {
    const web = path.join(root, 'frontend', 'dist', 'xodoprinter-frontend', 'browser');
    const target = path.join(root, 'target');
    const desktop = path.join(root, 'desktop');
    fs.mkdirSync(web, { recursive: true });
    fs.mkdirSync(target, { recursive: true });
    fs.mkdirSync(desktop, { recursive: true });
    fs.writeFileSync(path.join(web, 'index.html'), '<app-root></app-root>');
    fs.writeFileSync(path.join(web, 'main.js'), '/* compiled */');
    const jar = path.join(target, 'xodoprinter-0.2.0-SNAPSHOT.jar');
    fs.writeFileSync(jar, Buffer.from([0x50,0x4b,0x03,0x04,0,0]));
    fs.writeFileSync(path.join(target, 'xodoprinter-0.2.0-SNAPSHOT.jar.original'), 'original');

    assert.equal(findAngularOutput(root), web);
    assert.equal(findSpringBootJar(root), jar);
    const staged = stageBuild(root, desktop);
    assert.equal(fs.existsSync(path.join(staged.web, 'main.js')), true);
    assert.equal(fs.existsSync(staged.backendJar), true);
    assert.equal(fs.existsSync(jar), true);
    assert.equal(fs.existsSync(path.join(web, 'index.html')), true);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('sin compilaciones, devuelve instrucciones claras', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xodoprinter-empty-'));
  try { assert.throws(() => findAngularOutput(root), /pnpm build/); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
});
