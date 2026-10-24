'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { BACKEND_PORT, BUILT_FRONTEND_URL } = require('./config.cjs');

const MAX_API_BODY = 66 * 1024 * 1024; // Spring limits requests to about 65 MiB.
const CONTENT_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
});

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function stagedPaths(desktopDirectory = path.resolve(__dirname, '..')) {
  const staging = path.join(desktopDirectory, '.staged');
  return {
    webRoot: path.join(staging, 'web'),
    backendJar: path.join(staging, 'backend', 'xodoprinter.jar'),
    runtimeJava: path.join(staging, 'runtime', 'bin', 'java.exe'),
  };
}

/** Recursos fuera del ASAR, tal como electron-builder los coloca en Windows. */
function packagedPaths(resourcesDirectory) {
  const root = path.join(resourcesDirectory, 'xodo');
  return {
    webRoot: path.join(root, 'web'),
    backendJar: path.join(root, 'backend', 'xodoprinter.jar'),
    runtimeJava: path.join(root, 'runtime', 'bin', 'java.exe'),
  };
}

function validateAppUrl(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { return null; }
  if (url.protocol !== 'xodo:' || url.hostname !== 'app' || url.port ||
      url.username || url.password || url.hash || url.search) return null;
  return url;
}

// Never let a path from the renderer escape the built Angular directory.
function safeWebPath(webRoot, rawPath) {
  let decoded;
  try { decoded = decodeURIComponent(rawPath); } catch { return null; }
  if (!decoded.startsWith('/') || decoded.includes('\\') || decoded.includes('\0')) return null;
  const root = path.resolve(webRoot);
  const resolved = path.resolve(root, '.' + decoded);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return resolved;
}

function error(status, message) {
  return new Response(message, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function allowedApiRequest(method, pathname) {
  return (method === 'GET' && pathname === '/api/health') ||
    (method === 'POST' && pathname === '/api/prn/analyze');
}

/**
 * Pure routing logic, invoked from Electron's protocol.handle('xodo', ...).
 * fetchBackend is supplied by Electron's net.fetch (mocked in the tests).
 */
async function serveBundleRequest(request, { webRoot, fetchBackend, backendPort = BACKEND_PORT }) {
  const url = validateAppUrl(request.url);
  if (!url) return error(403, 'Origen no autorizado');

  if (url.pathname.startsWith('/api/')) {
    if (!allowedApiRequest(request.method, url.pathname)) return error(404, 'API no disponible');
    const headers = {};
    for (const key of ['content-type', 'accept']) {
      const value = request.headers?.get(key);
      if (value) headers[key] = value;
    }
    let body;
    if (request.method === 'POST') {
      const length = Number(request.headers?.get('content-length'));
      if (Number.isFinite(length) && length > MAX_API_BODY) return error(413, 'Archivo demasiado grande');
      const bytes = await request.arrayBuffer();
      if (bytes.byteLength > MAX_API_BODY) return error(413, 'Archivo demasiado grande');
      body = Buffer.from(bytes);
    }
    try {
      return await fetchBackend(`http://127.0.0.1:${backendPort}${url.pathname}`, {
        method: request.method,
        headers,
        ...(body === undefined ? {} : { body }),
        redirect: 'error',
      });
    } catch {
      return error(502, 'Motor Java no disponible');
    }
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') return error(405, 'Metodo no permitido');

  let target = safeWebPath(webRoot, url.pathname === '/' ? '/index.html' : url.pathname);
  if (!target) return error(403, 'Ruta fuera del frontend');

  try {
    let st;
    try { st = await fs.stat(target); } catch { st = null; }
    // Angular routes such as /jobs can use index.html. Missing /main.js must 404.
    if (!st || !st.isFile()) {
      if (path.extname(url.pathname)) return error(404, 'Archivo no encontrado');
      target = safeWebPath(webRoot, '/index.html');
      st = await fs.stat(target);
    }
    if (!st.isFile()) return error(404, 'Archivo no encontrado');

    // Defense in depth if a symlink is ever copied into the build directory.
    const realRoot = await fs.realpath(webRoot);
    const realTarget = await fs.realpath(target);
    const relative = path.relative(realRoot, realTarget);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return error(403, 'Ruta no autorizada');

    const ext = path.extname(target).toLowerCase();
    const headers = {
      'content-type': CONTENT_TYPES[ext] || 'application/octet-stream',
      'x-content-type-options': 'nosniff',
    };
    if (ext === '.html') {
      headers['content-security-policy'] = CSP;
      headers['cache-control'] = 'no-store';
    }
    if (request.method === 'HEAD') return new Response(null, { status: 200, headers });
    return new Response(await fs.readFile(target), { status: 200, headers });
  } catch {
    return error(404, 'Archivo no encontrado');
  }
}

module.exports = {
  BUILT_FRONTEND_URL, stagedPaths, packagedPaths, safeWebPath, allowedApiRequest,
  serveBundleRequest, validateAppUrl,
};
