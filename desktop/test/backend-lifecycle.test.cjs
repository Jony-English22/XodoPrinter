'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { prepareBackend } = require('../src/backend.cjs');

test('si el backend ya corre, Electron NO se adueña de él', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    status: 200,
    json: async () => ({
      status: 'UP', service: 'xodoprinter',
      mode: 'RESEARCH_ONLY', hardwareAccess: false,
    }),
  });
  try {
    const handle = await prepareBackend({});
    assert.equal(handle.owned, false);
    assert.doesNotThrow(() => handle.stop());
  } finally {
    global.fetch = originalFetch;
  }
});
