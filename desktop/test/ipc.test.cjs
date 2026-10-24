'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isTrustedIpcEvent } = require('../src/config.cjs');

const frontend = 'http://127.0.0.1:4202/';

function makeEvent(frameUrl = frontend) {
  const mainFrame = { url: frameUrl };
  const webContents = { mainFrame };
  return {
    event: { sender: webContents, senderFrame: mainFrame },
    window: { webContents },
  };
}

test('solo se acepta el frame principal de nuestra ventana local', () => {
  const { event, window } = makeEvent();
  assert.equal(isTrustedIpcEvent(event, window, frontend), true);
});

test('rechaza el iframe aun si comparte el mismo origen', () => {
  const { event, window } = makeEvent();
  event.senderFrame = { url: frontend };
  assert.equal(isTrustedIpcEvent(event, window, frontend), false);
});

test('rechaza otra ventana y una URL ajena', () => {
  const { event, window } = makeEvent();
  assert.equal(isTrustedIpcEvent({ ...event, sender: {} }, window, frontend), false);
  assert.equal(isTrustedIpcEvent(makeEvent('https://example.com').event, window, frontend), false);
  assert.equal(isTrustedIpcEvent(null, window, frontend), false);
});
