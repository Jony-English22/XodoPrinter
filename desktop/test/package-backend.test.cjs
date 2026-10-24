'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { prepareBackend } = require('../src/backend.cjs');

test('instalador rechaza reutilizar otro XodoPrinter aunque reporte health compatible', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    status: 200,
    json: async () => ({ status: 'UP', service: 'xodoprinter', mode: 'RESEARCH_ONLY', hardwareAccess: false }),
  });
  try {
    await assert.rejects(() => prepareBackend({}, { requireOwnership: true }), /Ya hay una instancia/);
  } finally { global.fetch = originalFetch; }
});
