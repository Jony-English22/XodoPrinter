'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  safeWebPath, serveBundleRequest, allowedApiRequest,
} = require('../src/bundle.cjs');
const {
  isTrustedFrontendUrl, isTrustedIpcEvent, BUILT_FRONTEND_URL,
} = require('../src/config.cjs');

function makeWeb() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xodoprinter-web-'));
  fs.writeFileSync(path.join(root, 'index.html'), '<html><app-root></app-root></html>');
  fs.writeFileSync(path.join(root, 'main-abc.js'), 'console.log("angular");');
  return root;
}

test('resuelve solo archivos dentro de Angular compilado', () => {
  const root = makeWeb();
  try {
    assert.equal(safeWebPath(root, '/main-abc.js'), path.join(root, 'main-abc.js'));
    assert.equal(safeWebPath(root, '/../../../etc/passwd'), null);
    assert.equal(safeWebPath(root, '/%5cWindows'), null);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('sirve el HTML con politica de seguridad y el JS local', async () => {
  const root = makeWeb();
  try {
    const index = await serveBundleRequest(new Request(BUILT_FRONTEND_URL), { webRoot: root });
    assert.equal(index.status, 200);
    assert.match(index.headers.get('content-security-policy'), /default-src 'self'/);
    assert.match(await index.text(), /app-root/);

    const js = await serveBundleRequest(new Request('xodo://app/main-abc.js'), { webRoot: root });
    assert.equal(js.status, 200);
    assert.match(js.headers.get('content-type'), /javascript/);
    assert.match(await js.text(), /angular/);

    const notFound = await serveBundleRequest(new Request('xodo://app/main-NOTFOUND.js'), { webRoot: root });
    assert.equal(notFound.status, 404);
    const route = await serveBundleRequest(new Request('xodo://app/trabajos'), { webRoot: root });
    assert.equal(route.status, 200);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('no acepta otra autoridad, esquemas externos ni referencias sospechosas', async () => {
  const root = makeWeb();
  try {
    for (const url of ['xodo://evil/', 'http://app/', 'xodo://user@app/']) {
      const req = { url, method: 'GET', headers: new Headers() };
      const resp = await serveBundleRequest(req, { webRoot: root });
      assert.equal(resp.status, 403, url);
    }
    assert.equal(isTrustedFrontendUrl('xodo://evil/', BUILT_FRONTEND_URL), false);
    assert.equal(isTrustedFrontendUrl('http://app/', BUILT_FRONTEND_URL), false);
    assert.equal(isTrustedFrontendUrl('xodo://app/main.js', BUILT_FRONTEND_URL), true);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('el IPC compilado solo se acepta desde el frame principal', () => {
  const mainFrame = { url: 'xodo://app/' };
  const contents = { mainFrame };
  const win = { webContents: contents };
  assert.equal(isTrustedIpcEvent({ sender: contents, senderFrame: mainFrame }, win, BUILT_FRONTEND_URL), true);
  assert.equal(isTrustedIpcEvent({ sender: contents, senderFrame: { url: mainFrame.url } }, win, BUILT_FRONTEND_URL), false);
  assert.equal(isTrustedIpcEvent({ sender: contents, senderFrame: { url: 'xodo://evil/' } }, win, BUILT_FRONTEND_URL), false);
});

test('redirige solo los dos endpoints que usa Angular, a loopback', async () => {
  const root = makeWeb();
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, ...options });
    return new Response('{"status":"UP"}', { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    assert.equal(allowedApiRequest('GET', '/api/health'), true);
    assert.equal(allowedApiRequest('POST', '/api/prn/analyze'), true);
    assert.equal(allowedApiRequest('POST', '/api/delete'), false);

    const health = await serveBundleRequest(new Request('xodo://app/api/health'), {
      webRoot: root, fetchBackend: fakeFetch,
    });
    assert.equal(health.status, 200);
    assert.equal(calls[0].url, 'http://127.0.0.1:8082/api/health');

    const data = Buffer.from('multipart-binary-prn-data');
    const post = new Request('xodo://app/api/prn/analyze', {
      method: 'POST',
      body: data,
      headers: { 'content-type': 'multipart/form-data; boundary=demo' },
    });
    const analyzed = await serveBundleRequest(post, { webRoot: root, fetchBackend: fakeFetch });
    assert.equal(analyzed.status, 200);
    assert.equal(calls[1].url, 'http://127.0.0.1:8082/api/prn/analyze');
    assert.equal(calls[1].headers['content-type'], 'multipart/form-data; boundary=demo');
    assert.deepEqual(calls[1].body, data);

    const denied = await serveBundleRequest(new Request('xodo://app/api/usb/reset', { method: 'POST' }), {
      webRoot: root, fetchBackend: fakeFetch,
    });
    assert.equal(denied.status, 404);
    assert.equal(calls.length, 2);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('si Java no responde, devuelve 502 sin filtrar detalles', async () => {
  const root = makeWeb();
  try {
    const resp = await serveBundleRequest(new Request('xodo://app/api/health'), {
      webRoot: root, fetchBackend: async () => { throw new Error('private-data'); },
    });
    assert.equal(resp.status, 502);
    assert.doesNotMatch(await resp.text(), /private-data/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
