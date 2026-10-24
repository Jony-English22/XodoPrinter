'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveFrontendUrl,
  isTrustedFrontendUrl,
} = require('../src/config.cjs');
const { isOurBackend } = require('../src/backend.cjs');

test('acepta Angular local en puerto 4202 y normaliza la ruta', () => {
  assert.equal(resolveFrontendUrl(), 'http://127.0.0.1:4202/');
  assert.equal(resolveFrontendUrl('http://localhost:4200'), 'http://localhost:4200/');
});

test('rechaza URLs remotas, esquemas peligrosos y rutas inesperadas', () => {
  for (const url of [
    'https://example.com:4202',
    'http://192.168.1.7:4202',
    'file:///C:/foo',
    'javascript:alert(1)',
    'http://localhost:4200/otra-ruta',
    'http://usuario:clave@localhost:4200',
  ]) {
    assert.throws(() => resolveFrontendUrl(url));
  }
});

test('acepta navegacion interna y deniega dominios externos', () => {
  const base = resolveFrontendUrl('http://localhost:4202');
  assert.equal(isTrustedFrontendUrl('http://localhost:4202/', base), true);
  assert.equal(isTrustedFrontendUrl('http://localhost:4202/trabajos', base), true);
  assert.equal(isTrustedFrontendUrl('https://example.com', base), false);
  assert.equal(isTrustedFrontendUrl('http://localhost:8765/api/health', base), false);
  assert.equal(isTrustedFrontendUrl('invalid!', base), false);
});

test('reconoce solo el health del laboratorio sin acceso a hardware', () => {
  const good = { status: 'UP', service: 'xodoprinter', mode: 'RESEARCH_ONLY', hardwareAccess: false };
  assert.equal(isOurBackend(200, good), true);
  assert.equal(isOurBackend(200, { ...good, hardwareAccess: true }), false);
  assert.equal(isOurBackend(200, { ...good, service: 'otro' }), false);
  assert.equal(isOurBackend(500, good), false);
  assert.equal(isOurBackend(200, null), false);
});
