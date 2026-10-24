'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { once } = require('node:events');
const { serveBundleRequest } = require('../src/bundle.cjs');

test('el puente HTTP conserva el cuerpo multipart y la respuesta JSON', async () => {
  const webRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'xodo-http-'));
  fs.writeFileSync(path.join(webRoot, 'index.html'), '<app-root></app-root>');
  const seen = [];
  const server = http.createServer(async (req, res) => {
    const buffers = [];
    for await (const chunk of req) buffers.push(chunk);
    seen.push({ method: req.method, url: req.url, contentType: req.headers['content-type'], body: Buffer.concat(buffers) });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ recognized: true, fileSize: 72 }));
  });
  try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = server.address().port;
    const multipart = Buffer.from('--BOUNDARY\r\nContent-Disposition: form-data; name="file"; filename="test.prn"\r\n\r\nHELLO\r\n--BOUNDARY--\r\n');
    const request = new Request('xodo://app/api/prn/analyze', {
      method: 'POST', headers: { 'content-type': 'multipart/form-data; boundary=BOUNDARY' }, body: multipart,
    });
    const result = await serveBundleRequest(request, { webRoot, backendPort: port, fetchBackend: fetch });
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), { recognized: true, fileSize: 72 });
    assert.equal(seen.length, 1);
    assert.equal(seen[0].method, 'POST');
    assert.equal(seen[0].url, '/api/prn/analyze');
    assert.equal(seen[0].contentType, 'multipart/form-data; boundary=BOUNDARY');
    assert.deepEqual(seen[0].body, multipart);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(webRoot, { recursive: true, force: true });
  }
});
