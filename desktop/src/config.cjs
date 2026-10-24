'use strict';

const DEFAULT_FRONTEND_URL = 'http://127.0.0.1:4202';
const BUILT_FRONTEND_URL = 'xodo://app/';
const BACKEND_PORT = 8082;
const BACKEND_HEALTH_URL = `http://127.0.0.1:${BACKEND_PORT}/api/health`;

function resolveFrontendUrl(raw = DEFAULT_FRONTEND_URL) {
  let url;
  try { url = new URL(raw); }
  catch { throw new Error('XODO_FRONTEND_URL no contiene una URL valida.'); }
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)) {
    throw new Error('Angular de desarrollo debe estar en loopback (localhost).');
  }
  if (!url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('XODO_FRONTEND_URL debe tener un puerto, sin ruta ni credenciales.');
  }
  return url.origin + '/';
}

function isTrustedFrontendUrl(requestUrl, frontendUrl) {
  try {
    const target = new URL(requestUrl);
    if (frontendUrl === BUILT_FRONTEND_URL) {
      // Important: for custom schemes, URL.origin can be "null" in Node.
      // Compare protocol and authority explicitly to avoid trusting another scheme.
      return target.protocol === 'xodo:' && target.hostname === 'app' &&
        !target.port && !target.username && !target.password;
    }
    return target.origin === new URL(frontendUrl).origin &&
      ['http:', 'https:'].includes(target.protocol);
  } catch { return false; }
}

function isTrustedIpcEvent(event, browserWindow, frontendUrl) {
  if (!event || !browserWindow?.webContents || !event.senderFrame) return false;
  const expectedContents = browserWindow.webContents;
  return event.sender === expectedContents &&
    event.senderFrame === expectedContents.mainFrame &&
    isTrustedFrontendUrl(event.senderFrame.url, frontendUrl);
}

module.exports = {
  resolveFrontendUrl, isTrustedFrontendUrl, isTrustedIpcEvent,
  BUILT_FRONTEND_URL, BACKEND_PORT, BACKEND_HEALTH_URL,
};
