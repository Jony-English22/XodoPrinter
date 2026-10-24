'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Solo exponemos una operacion concreta y de solo lectura.
 * NO publicamos ipcRenderer, require, Node.js ni comandos USB.
 */
contextBridge.exposeInMainWorld('xodoDesktop', Object.freeze({
  getInfo: () => ipcRenderer.invoke('xodo:get-info'),
}));
