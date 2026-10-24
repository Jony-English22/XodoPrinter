'use strict';

const { existsSync } = require('node:fs');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { BACKEND_HEALTH_URL, BACKEND_PORT } = require('./config.cjs');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Solo aceptamos la identidad del backend de investigacion de XodoPrinter. */
function isOurBackend(status, responseBody) {
  return status === 200 && responseBody !== null &&
    responseBody.status === 'UP' &&
    responseBody.service === 'xodoprinter' &&
    responseBody.mode === 'RESEARCH_ONLY' &&
    responseBody.hardwareAccess === false;
}

/** 'ours', 'other' o 'unreachable'. Nunca modifica el backend. */
async function probeBackend(healthUrl = BACKEND_HEALTH_URL) {
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(1200), cache: 'no-store' });
    let body = null;
    try { body = await response.json(); } catch { /* Puede responder otro servicio. */ }
    return isOurBackend(response.status, body) ? 'ours' : 'other';
  } catch {
    return 'unreachable';
  }
}

/**
 * Si Spring Boot ya esta abierto, lo usa SIN poseerlo ni cerrarlo.
 * Solo inicia un proceso propio cuando XODO_BACKEND_JAR contiene una ruta valida.
 * No envia comandos al USB ni invoca ninguna funcion de impresion.
 */
async function prepareBackend(env = process.env, options = {}) {
  const existing = await probeBackend();
  if (existing === 'ours') {
    if (options.requireOwnership) {
      throw new Error('Ya hay una instancia de XodoPrinter en el puerto 8082. Cierra solo tu instancia anterior antes de abrir el instalador de laboratorio.');
    }
    console.log('[desktop] Backend de XodoPrinter ya abierto: se deja bajo control de quien lo inicio.');
    return { owned: false, stop() {} };
  }
  if (existing === 'other') {
    throw new Error(`El puerto ${BACKEND_PORT} responde, pero no es el backend esperado de XodoPrinter.`);
  }

  if (!env.XODO_BACKEND_JAR) {
    console.warn('[desktop] Backend no disponible. Inicia Spring Boot aparte (puerto 8082).');
    return { owned: false, stop() {} };
  }

  const jarPath = path.resolve(env.XODO_BACKEND_JAR);
  if (!existsSync(jarPath) || !jarPath.toLowerCase().endsWith('.jar')) {
    throw new Error(`XODO_BACKEND_JAR no apunta a un JAR existente: ${jarPath}`);
  }

  const java = env.XODO_JAVA || 'java';
  const child = spawn(java, [
    '-jar', jarPath,
    '--server.address=127.0.0.1',
    `--server.port=${BACKEND_PORT}`,
  ], {
    cwd: path.dirname(jarPath),
    windowsHide: true,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let spawnError;
  child.on('error', (error) => { spawnError = error; });
  child.stdout.on('data', (data) => process.stdout.write(`[java] ${data}`));
  child.stderr.on('data', (data) => process.stderr.write(`[java] ${data}`));
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (child.exitCode === null && child.signalCode === null) child.kill();
  };

  console.log(`[desktop] Iniciando Java desde ${jarPath} ...`);
  try {
    for (let attempt = 0; attempt < 40; attempt++) {
      if (spawnError) throw spawnError;
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error('Java termino antes de responder /api/health.');
      }
      const health = await probeBackend();
      if (health === 'ours') {
        console.log('[desktop] Backend iniciado por Electron y listo.');
        return { owned: true, stop };
      }
      if (health === 'other') {
        throw new Error('Otro servicio ocupa el puerto del backend de XodoPrinter.');
      }
      await sleep(500);
    }
    throw new Error('Tiempo de espera agotado al iniciar el backend Java.');
  } catch (error) {
    stop();
    throw error;
  }
}

module.exports = { isOurBackend, probeBackend, prepareBackend };
