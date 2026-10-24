# XodoPrinter — Clase 11: IPC seguro y ciclo de vida del escritorio

> Etapa: Angular + Electron + Spring Boot, **solo laboratorio**. Objetivo: comprender lo que ya funciona y realizar una ampliación pequeña, verificable y segura. No instalaremos controladores USB ni enviaremos comandos físicos al Flyjet.

## 0. Punto de partida

Ya tienes funcionando:

- **Angular** servido localmente, normalmente en `http://127.0.0.1:4202/`.
- **Spring Boot** en `http://127.0.0.1:8082/`, con `GET /api/health` y `POST /api/prn/analyze`.
- **Electron** creando la ventana de escritorio, cargando Angular y usando el backend Java.
- **PRN**: solo análisis de su estructura. *Reconocido* no significa *imprimible*.

No reemplazaremos tu backend Java. Este parche solamente modifica `desktop/` y `frontend/`.

## 1. El nuevo objetivo

Mostrar, en el lateral de Angular, información obtenida del **proceso principal de Electron** (nombre de la app, versión, plataforma y versión de Electron). Angular **no debe importar Electron ni Node.js directamente**.

Al mismo tiempo, reforzamos el manejador IPC para admitir solicitudes únicamente desde el **frame principal** de nuestra ventana confiable. Esto no convierte al laboratorio en un paquete de producción, pero permite aprender una práctica de aislamiento útil.

## 2. Tres espacios distintos

| Espacio | Archivo de ejemplo | ¿Qué hace? | ¿Qué NO debería hacer? |
| --- | --- | --- | --- |
| **Main (Electron)** | `desktop/src/main.cjs` | Crea ventanas, administra procesos, recibe IPC | Interpretar PRN o implementar el protocolo del plotter |
| **Preload** | `desktop/src/preload.cjs` | Publica operaciones muy concretas en `window.xodoDesktop` | Exponer `require`, `ipcRenderer` completo o comandos genéricos |
| **Renderer (Angular)** | `frontend/src/app/app.ts` | Muestra estados, maneja clics y archivos | Controlar directamente dispositivos, ejecutar procesos o abrir puertos |

### Comunicación 1: Angular con Java

```text
Angular -- HTTP POST /api/prn/analyze --> Spring Boot
Angular <-- JSON PrnAnalysisResult ----- Spring Boot
```

Este recorrido ya funciona y no cambia.

### Comunicación 2: Angular con Electron

```text
Angular
  `-- DesktopIntegrationService.getInfo()
           `-- window.xodoDesktop.getInfo()
                 `-- preload.cjs: ipcRenderer.invoke('xodo:get-info')
                       `-- main.cjs: ipcMain.handle('xodo:get-info')
                             `-- valida la ventana/frame de origen
                             `-- consulta app.getName(), app.getVersion(), etc.
                       <-- retorna objeto pequeño de solo lectura
                 <-- Promise
           <-- Promise<XodoDesktopInfo | null>
  <-- signal desktopInfo() -> UI
```

**Clave:** `IPC` significa *inter-process communication*, comunicación entre procesos. No es una petición HTTP ni requiere pasar por Spring Boot.

## 3. Qué hace cada archivo del parche

### `desktop/src/main.cjs`

Ya existía la función `registerDesktopBridge()`. Mantenemos el canal `xodo:get-info`, pero sustituimos la comprobación de `event.sender.getURL()` por `isTrustedIpcEvent(event, mainWindow, frontendUrl)`.

El objeto retornado es:

```js
return {
  appName: app.getName(),
  appVersion: app.getVersion(),
  platform: process.platform,
  electronVersion: process.versions.electron,
  environment: 'development',
};
```

No se proporciona a Angular la capacidad de iniciar comandos del sistema.

### `desktop/src/config.cjs`

Nueva función pura `isTrustedIpcEvent()`:

1. Comprueba que hay una ventana y un `senderFrame`.
2. Comprueba que el emisor corresponde a **nuestro** `webContents`.
3. Comprueba que el frame emisor es el **frame principal** (`webContents.mainFrame`), no otro iframe.
4. Comprueba que la URL pertenece al origen local esperado.

**Por qué:** verificar únicamente la URL del WebContents principal puede ser insuficiente si en el futuro hay frames adicionales. La documentación oficial de Electron recomienda validar los emisores de cada mensaje IPC. La validación actual es para la ventana de desarrollo: la versión empaquetada necesitará otro origen confiable, política CSP y una revisión de seguridad adicional.

### `desktop/src/preload.cjs` (ya existía; no hace falta reemplazarlo)

```js
contextBridge.exposeInMainWorld('xodoDesktop', Object.freeze({
  getInfo: () => ipcRenderer.invoke('xodo:get-info'),
}));
```

Angular puede invocar **exactamente esa función**. No puede enviar mensajes IPC arbitrarios porque nunca le entregamos `ipcRenderer`.

### `frontend/src/app/core/desktop/desktop-bridge.d.ts`

Declara para TypeScript que `window.xodoDesktop` es opcional y que `getInfo()` devuelve una promesa. Sin esta declaración, el editor podría señalar que `xodoDesktop` no existe en el tipo `Window`.

Esto es **información de tipos**, no genera por sí solo una funcionalidad de Electron. El puente real lo publica `preload.cjs`.

### `frontend/src/app/core/desktop/desktop-integration.service.ts`

```ts
isAvailable(): boolean {
  return typeof window !== 'undefined' &&
    typeof window.xodoDesktop?.getInfo === 'function';
}

getInfo(): Promise<XodoDesktopInfo | null> {
  if (!this.isAvailable()) return Promise.resolve(null);
  return window.xodoDesktop!.getInfo();
}
```

Este servicio permite **usar la misma interfaz Angular dentro de Chrome o Electron**. Si abrimos Angular en el navegador, `getInfo()` devuelve `null` sin producir un error.

### `frontend/src/app/app.ts`

Usa **inyección de dependencias** para obtener `DesktopIntegrationService` y una **signal** para reflejar la respuesta en la interfaz:

```ts
private readonly desktop = inject(DesktopIntegrationService);
readonly desktopInfo = signal<XodoDesktopInfo | null>(null);

async loadDesktopInfo(): Promise<void> {
  if (!this.desktop.isAvailable()) return;
  try {
    this.desktopInfo.set(await this.desktop.getInfo());
  } catch {
    this.desktopInfoError.set(true);
  }
}
```

Se invoca desde `ngOnInit()`. Angular actualiza la vista cuando `desktopInfo.set()` cambia el dato. El proyecto sigue usando `PrnApiService` para comunicarse con Java.

### `frontend/src/app/app.html` y `.css`

Agregamos un pequeño bloque informativo en la parte inferior del lateral. Cuando corre en Electron muestra la versión, Windows y Electron. En Chrome muestra `Modo navegador (sin Electron)`. Conservamos el diseño blanco y negro original.

## 4. Cómo aplicar el parche en tu repositorio

**Antes de copiar:** revisa `git status` y guarda tus modificaciones en un commit o copia de seguridad. Este paquete **sobrescribe** algunos archivos `app.*`, `main.cjs` y `config.cjs`, por lo que debes fusionar los cambios manualmente si los editaste desde la clase 10.

1. Extrae `xodoprinter-clase11-ipc.zip` en una carpeta temporal.
2. Copia las carpetas `desktop/` y `frontend/` extraídas encima de las carpetas del repositorio **conservando su estructura**.
3. El parche agrega archivos nuevos de pruebas y un servicio Angular; no sustituye `pom.xml`, `backend.cjs`, `preload.cjs`, `prn-inspector` ni Spring Boot.
4. Comprueba en IntelliJ o VS Code que existen las rutas indicadas arriba.

La versión completa de los archivos está en el ZIP. Es un **parche**, no un proyecto independiente: necesita tu XodoPrinter 0.4 funcionando.

## 5. Ejecutar y verificar

### Terminal 1 (raíz donde está el `pom.xml`)

```powershell
mvn spring-boot:run
```

### Terminal 2 (`frontend/`)

```powershell
pnpm test
pnpm start
```

Las pruebas existentes de `PrnApiService` siguen ahí. La nueva `desktop-integration.service.spec.ts` agrega dos casos: navegador normal y puente Electron simulado.

### Terminal 3 (`desktop/`)

```powershell
pnpm test
pnpm start
```

Con los archivos del laboratorio, esperamos **8 pruebas del módulo desktop** (4 anteriores y 4 nuevas agrupadas en dos archivos). En mi entorno estas ocho pruebas de Node finalizaron con `pass 8 / fail 0`. Las pruebas Angular deben verificarse en tu equipo, porque mi entorno no tiene todas las dependencias Angular instaladas.

### Resultado visual esperado

- En **Chrome**: `Modo navegador (sin Electron)`.
- En **Electron**: `xodoprinter-desktop v0.4.0` y `Windows · Electron 45.0.0` (los valores reales se leen del proceso Electron y podrían variar si modificas versiones).
- El botón **Analizar archivo** continúa funcionando igual, porque no hemos cambiado el contrato con Java.

## 6. Entender el ciclo de vida de Java

Tu archivo `desktop/src/backend.cjs` de la clase 10 ya contiene `prepareBackend()`. Estúdialo **sin modificarlo** en esta clase.

```text
Electron inicia
  |
  v
GET http://127.0.0.1:8082/api/health
  |
  +-- Responde nuestro backend: usarlo, owned = false
  |                              al cerrar NO detener Java
  |
  +-- Responde otro servicio: abortar, no reemplazarlo
  |
  +-- No responde:
         +-- Sin XODO_BACKEND_JAR: informar y continuar (Java por separado)
         +-- Con XODO_BACKEND_JAR: lanzar ese JAR; owned = true
                                         al cerrar detener SOLO ese proceso
```

**Ejercicio opcional** (en tu Windows 11 de desarrollo, no en la PC Windows 7 de producción):

1. Detén solamente la instancia de Spring Boot que iniciaste manualmente para desarrollo.
2. Construye un JAR ejecutable con `mvn clean package`.
3. Comprueba el nombre real del archivo: `Get-ChildItem .\\target\\*.jar` desde la raíz del backend.
4. En una consola dentro de `desktop/`, establece la ruta absoluta real del JAR:

```powershell
$env:XODO_BACKEND_JAR = 'C:\\ruta\\real\\de\\tu\\target\\xodoprinter.jar'
pnpm start
```

El nombre de arriba es **un ejemplo**: sustituye la ruta completa. Angular debe seguir activo por separado.

Cuando Electron inicie Java por su cuenta, imprimirá en consola que el backend está listo. Si ya existe uno válido, lo reutilizará sin reclamar su propiedad. Cerrar Electron no debe cerrar el Java que tú arrancaste manualmente.

**Advertencia:** esta lógica de arranque/parada es de laboratorio. Para un instalador real habrá que empaquetar Java, verificar proceso y árbol de subprocesos en Windows, gestionar puerto dinámico y autenticación, y no depender de un servidor Angular de desarrollo.

## 7. Ejercicios de comprensión

1. ¿Por qué `getInfo()` devuelve una `Promise` en vez de un objeto inmediato?
2. ¿Qué ocurriría si `window.xodoDesktop` no existiera (Chrome)?
3. ¿Por qué es preferible exponer `getInfo()` en lugar de `ipcRenderer` completo?
4. ¿En qué se diferencia `GET /api/health` de `window.xodoDesktop.getInfo()`?
5. ¿Qué debería pasar al cerrar Electron si Java ya estaba ejecutándose antes de abrir la ventana?

**Respuestas:** 1) IPC es asincrónico; 2) retorna `null` y muestra modo navegador; 3) limita las operaciones privilegiadas; 4) HTTP al backend frente a IPC hacia Electron; 5) Java permanece en ejecución porque Electron no es su propietario.

## 8. Qué viene después

**Clase 12: distribución local sin navegador de desarrollo.** Primero compilaremos Angular y lo cargaremos como archivos empaquetados mediante un origen local controlado; después prepararemos un runtime Java integrado, autenticación entre procesos y un instalador Windows. Antes de ofrecer un `.exe` a usuarios reales, tendremos que probar rigurosamente esa integración. **Aún no estamos trabajando con el hardware físico ni con el protocolo USB del plotter.**

## Referencias técnicas

- Electron — Inter-Process Communication: https://www.electronjs.org/docs/latest/tutorial/ipc
- Electron — Context Isolation: https://www.electronjs.org/docs/latest/tutorial/context-isolation
- Electron — Security: https://www.electronjs.org/docs/latest/tutorial/security
- Electron — contextBridge: https://www.electronjs.org/docs/latest/api/context-bridge
