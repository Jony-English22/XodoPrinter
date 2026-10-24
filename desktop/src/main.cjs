'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow, dialog, ipcMain, session, protocol, net, Menu } = require('electron');
const {
  resolveFrontendUrl, isTrustedFrontendUrl, isTrustedIpcEvent, BUILT_FRONTEND_URL,
} = require('./config.cjs');
const { stagedPaths, packagedPaths, serveBundleRequest } = require('./bundle.cjs');
const { prepareBackend, probeBackend } = require('./backend.cjs');

// El .exe empaquetado SIEMPRE usa Angular compilado; no utiliza localhost:4202.
const builtPreview = app.isPackaged || process.argv.includes('--built');
const frontendUrl = builtPreview
  ? BUILT_FRONTEND_URL
  : resolveFrontendUrl(process.env.XODO_FRONTEND_URL);

// El esquema debe registrarse ANTES de app.whenReady().
if (builtPreview) {
  protocol.registerSchemesAsPrivileged([{
    scheme: 'xodo',
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  }]);
}

let mainWindow = null;
let backendHandle = null;

async function isAngularRunning() {
  try {
    const response = await fetch(frontendUrl, { signal: AbortSignal.timeout(2200) });
    if (!response.ok) return false;
    return (await response.text()).includes('<app-root');
  } catch { return false; }
}

async function registerBuiltFrontend() {
  // En desarrollo: desktop/.staged. En .exe: resources/xodo.
  const paths = app.isPackaged
    ? packagedPaths(process.resourcesPath)
    : stagedPaths(path.resolve(__dirname, '..'));

  const required = [path.join(paths.webRoot, 'index.html'), paths.backendJar];
  if (app.isPackaged) required.push(paths.runtimeJava);
  for (const file of required) {
    if (!fs.existsSync(file)) {
      throw new Error(`Falta un recurso compilado: ${file}. Repite package:prepare / package:dir.`);
    }
  }
  protocol.handle('xodo', (request) => serveBundleRequest(request, {
    webRoot: paths.webRoot,
    fetchBackend: (url, options) => net.fetch(url, options),
  }));
  return paths;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'XodoPrinter - Laboratorio PRN',
    width: 1320,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#ffffff',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, destination) => {
    if (!isTrustedFrontendUrl(destination, frontendUrl) ||
        (builtPreview && new URL(destination).pathname.startsWith('/api/'))) {
      event.preventDefault();
    }
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  await mainWindow.loadURL(frontendUrl);
}

function registerDesktopBridge() {
  ipcMain.handle('xodo:get-info', (event) => {
    if (!isTrustedIpcEvent(event, mainWindow, frontendUrl)) {
      throw new Error('IPC rechazado: solo el frame principal confiable.');
    }
    return {
      appName: app.getName(),
      appVersion: app.getVersion(),
      platform: process.platform,
      electronVersion: process.versions.electron,
      environment: app.isPackaged ? 'laboratory-package' :
        (builtPreview ? 'compiled-preview' : 'development'),
    };
  });
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    session.defaultSession.setPermissionRequestHandler((_sender, _permission, callback) => callback(false));
    registerDesktopBridge();
    if (app.isPackaged) {
      Menu.setApplicationMenu(null);
      app.setAppUserModelId('com.twdev.xodoprinter.laboratorio');
    }

    if (builtPreview) {
      const built = await registerBuiltFrontend();
      const env = { ...process.env, XODO_BACKEND_JAR: built.backendJar };
      if (fs.existsSync(built.runtimeJava)) env.XODO_JAVA = built.runtimeJava;
      // En un ejecutable no reutilizamos otro backend abierto en el puerto fijo.
      backendHandle = await prepareBackend(env, { requireOwnership: app.isPackaged });
      if ((await probeBackend()) !== 'ours') {
        throw new Error('Spring Boot no responde como XodoPrinter en el puerto 8082.');
      }
      console.log('[desktop] Angular compilado y Java privado listos.');
    } else {
      backendHandle = await prepareBackend();
      if (!(await isAngularRunning())) {
        throw new Error(`Angular no responde en ${frontendUrl}. Ejecuta pnpm start en frontend.`);
      }
    }
    await createWindow();
  }).catch((err) => {
    console.error('[desktop]', err);
    dialog.showErrorBox('No se pudo iniciar XodoPrinter', err.message);
    app.quit();
  });
}

app.on('before-quit', () => { backendHandle?.stop(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => {
  if (hasLock && !mainWindow) {
    createWindow().catch((err) => console.error('[desktop]', err));
  }
});
