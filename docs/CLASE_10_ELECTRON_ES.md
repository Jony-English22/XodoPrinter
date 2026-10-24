# Clase 10 — Electron: XodoPrinter como aplicación de escritorio

> **Guía de aprendizaje para la versión 0.4 (24 de octubre de 2026).** La finalidad es que comprendas cada pieza, no simplemente conseguir una ventana. La aplicación continúa en modo **investigación sin acceso al hardware**. Nunca instales ni pruebes este laboratorio en la PC Windows 7 de producción.

## Objetivos de la clase

Al terminar podrás explicar:

1. En qué se diferencia Angular de Electron y de Spring Boot.
2. Qué es el **proceso principal**, qué es el **proceso de interfaz** y por qué se aíslan.
3. Para qué sirven `BrowserWindow`, `preload`, `contextBridge` e IPC.
4. Por qué Angular debe seguir usando una API HTTP local sin llamar directamente a un driver USB.
5. Cómo trabajar con el backend que ya tienes en 8082 y el frontend que ya corre en 4202.
6. Cómo iniciar opcionalmente un JAR propio de Java desde Electron y cerrarlo de manera controlada.
7. Qué falta para conseguir un instalador de Windows listo para distribuir.

## 1. Estado que ya comprobaste

El flujo que validaste en XodoPrinter 0.3 es:

```text
Chrome -> http://localhost:4202 (Angular)
                 |
          POST /api/prn/analyze
                 |
           Proxy de Angular
                 |
            127.0.0.1:8082
                 |
           Spring Boot
                 |
  PrnAnalysisController -> PrnAnalysisService
                 |
            PrnInspector
                 |
             JSON de vuelta
```

**Resultado comprobado por ti:** el archivo sintético `synthetic-valid-3x2.prn` se interpreta como **72 bytes**, con **3 × 2** y **4 unidades de canal candidatas**. Son campos de investigación, no dimensiones físicas confirmadas ni capacidad de impresión real.

Ahora pondremos Electron delante de Angular. Spring Boot, el inspector y los DTO **no necesitan reescribirse**.

## 2. La arquitectura de tres procesos

```text
PROCESO 1: Electron (main process; Node.js)
 ├─ Crea una BrowserWindow de Windows
 ├─ Restringe la navegación y los permisos
 ├─ Opcionalmente inicia un JAR local de Java
 └─ Cierra SOLO el proceso Java que él mismo abrió
                  |
                  v
PROCESO 2: Renderizador Chromium (Angular)
 ├─ HTML/CSS/TypeScript: formulario PRN, pantalla y resultados
 ├─ HttpClient -> /api/health y /api/prn/analyze
 └─ Recibe JSON; sin acceso libre a Node.js
                  |
             proxy dev
                  v
PROCESO 3: Java (Spring Boot)
 ├─ HealthController
 ├─ PrnAnalysisController
 ├─ PrnAnalysisService
 └─ PrnInspector (solo lectura)
```

**Pregunta de comprensión:** si Electron crea la ventana, ¿quién analiza los bytes del PRN? **Java**, no Electron ni Angular. Si el backend deja de responder, puede seguir viéndose la ventana; la pantalla mostrará el motor desconectado.

### Un dato importante sobre consumo

Electron incluye Chromium. No es un WebView especialmente ligero: gana compatibilidad y una experiencia web completa a costa de más RAM y tamaño de distribución. Posteriormente podremos comparar alternativas como Tauri, sin necesidad de cambiar el motor Java.

## 3. Antes de copiar archivos: usa Git

Desde el directorio de **tu repositorio**, en PowerShell:

```powershell
git status
git switch -c feature/electron-desktop
```

Si ya estás en una rama de trabajo que deseas conservar, puedes permanecer en ella. La entrega contiene dos ZIP: uno con **solo `desktop/`** para agregar a tu repo y una copia completa de referencia 0.4. **No sobrescribas tu código Java, tu Angular funcional, tus pruebas o tus ajustes locales con la copia de referencia.**

La estructura prevista es:

```text
XodoPrinter/
├─ pom.xml                   # Si Spring Boot esta en la raiz: se conserva
├─ src/...                   # Motor Java: se conserva
├─ frontend/                 # Tu Angular 0.3: se conserva
│  ├─ angular.json
│  └─ src/proxy.conf.json    # /api/** -> 127.0.0.1:8082
└─ desktop/                  # CARPETA NUEVA de la clase 10
   ├─ package.json
   ├─ pnpm-workspace.yaml
   ├─ src/
   │  ├─ main.cjs
   │  ├─ config.cjs
   │  ├─ backend.cjs
   │  └─ preload.cjs
   └─ test/config.test.cjs
```

Si en tu repo Spring Boot está en `backend/`, no hay problema. Electron no depende de la ubicación del `pom.xml` en el modo básico. Lo importante es que Spring responda en **8082**.

## 4. Primer arranque: exactamente tres terminales

**Terminal 1 — Backend Java** (carpeta con el `pom.xml`):

```powershell
mvn spring-boot:run
```

En otra terminal de verificación, si lo deseas:

```powershell
Invoke-RestMethod http://127.0.0.1:8082/api/health
```

La respuesta debe tener `status: UP`, `service: xodoprinter`, `mode: RESEARCH_ONLY` y `hardwareAccess: false`. Este health **no indica que el plotter esté conectado**.

**Terminal 2 — Angular** (dentro de `frontend/`):

```powershell
pnpm start
```

Comprueba la dirección que imprime la consola. En tu equipo la pantalla se abrió en **http://localhost:4202**. En el ZIP completo de referencia el puerto predeterminado se configura en 4202 y `proxy.conf.json` apunta al backend 8082. En tu repo conserva la configuración que ya corregiste.

**Terminal 3 — Electron** (dentro de `desktop/`):

```powershell
pnpm install
pnpm test
pnpm start
```

Debe aparecer una **ventana independiente de Windows** mostrando el mismo analizador PRN. Ahora el usuario no necesita abrir una pestaña de Chrome; Electron se ocupa de la ventana. Comprueba que el análisis de `synthetic-valid-3x2.prn` siga mostrando 72 bytes / 3 × 2 / 4 candidatos.

Si Angular está en 4200, 4203 u otro puerto, especifica el real **antes de ejecutar `pnpm start` en `desktop/`**:

```powershell
$env:XODO_FRONTEND_URL = 'http://127.0.0.1:4200'
pnpm start
```

Después de usar la variable puedes borrarla con `Remove-Item Env:XODO_FRONTEND_URL`.

## 5. `package.json` — quién ejecuta Electron

Archivo: `desktop/package.json`.

```json
{
  "name": "xodoprinter-desktop",
  "version": "0.4.0",
  "main": "src/main.cjs",
  "scripts": {
    "start": "electron .",
    "test": "node --test"
  },
  "devDependencies": {
    "electron": "45.0.0"
  }
}
```

**Por qué existe `desktop/package.json`:** Angular y Electron son proyectos Node independientes: uno **construye la interfaz** y el otro **ejecuta la ventana**. No hace falta colocar Electron en todas las dependencias de Angular.

`"main"` indica la entrada Electron. `"start"` significa ejecutar el binario de Electron pasando como carpeta de aplicación la actual (`.`). `"test"` ejecuta pruebas con el módulo incorporado `node:test`.

Para reproducir esta clase fijamos **Electron 45.0.0** (línea estable disponible en octubre de 2026). El binario puede descargarse la **primera vez que lo ejecutas**; una vez instalado, la ventana y el análisis local no requieren Internet.

### ¿Es necesario `pnpm approve-builds`?

En **Electron 42 y posteriores**, el binario dejó de descargarse mediante un script `postinstall` convencional; el primer uso de Electron puede descargarlo. Si pnpm 11 reporta scripts ignorados, revisa cuál dependencia los solicita y autoriza solo las necesarias y confiables. No habilites globalmente todos los scripts. El `pnpm-workspace.yaml` suministrado tiene inicialmente `allowBuilds: {}`.

## 6. `main.cjs` — el proceso principal

Este archivo es el equivalente conceptual al punto de entrada de una aplicación de escritorio. A diferencia de `main()` en Java, este código corre bajo Electron/Node.js.

### 6.1 Crear una ventana

```javascript
mainWindow = new BrowserWindow({
  title: 'XodoPrinter - Laboratorio PRN',
  width: 1320,
  height: 840,
  minWidth: 900,
  minHeight: 600,
  show: false,
  webPreferences: {
    preload: path.join(__dirname, 'preload.cjs'),
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
  },
});
```

- `BrowserWindow`: ventana de aplicación Windows.
- `width` y `height`: tamaño inicial de la ventana, no resolución de impresión.
- `preload`: script que corre antes del frontend para exponer funciones estrictamente limitadas.
- `nodeIntegration: false`: Angular **no** obtiene acceso directo a las APIs de Node.js.
- `contextIsolation: true`: separa el JavaScript de Angular del contexto privilegiado.
- `sandbox: true`: restringe las capacidades del proceso que representa la página.
- `webSecurity: true`: conserva políticas de seguridad habituales del contenido web.

**No cambies estos ajustes a `false` para solucionar errores.** Sería una forma incorrecta de eliminar protecciones.

### 6.2 Cargar Angular

```javascript
await mainWindow.loadURL(frontendUrl);
```

En la primera versión `frontendUrl` suele ser `http://127.0.0.1:4202/`. **Electron no compila Angular ni inventa un nuevo backend**: abre el servidor Angular ya iniciado. Por eso hay tres terminales durante el desarrollo.

### 6.3 Navegación y permisos

`setWindowOpenHandler()` deniega ventanas nuevas. `will-navigate` impide pasar a un origen diferente del frontend local. `setPermissionRequestHandler()` rechaza permisos no solicitados en nuestro laboratorio.

**Ejemplo:** un enlace malicioso no debe poder transformar nuestra ventana con un contexto privilegiado en un navegador de páginas externas. En una versión futura crearemos una política de enlaces externos más completa.

### 6.4 ¿Qué hace `app.whenReady()`?

Electron administra su propio ciclo de vida. `whenReady()` es una promesa: nuestro programa espera hasta que Electron haya inicializado lo necesario antes de crear la ventana. Se parece a esperar que una dependencia esté inicializada antes de invocarla; no es un bucle manual de espera.

El código `requestSingleInstanceLock()` también evita abrir dos instancias del mismo escritorio simultáneamente, para reducir conflictos con recursos locales.

## 7. `config.cjs` — por qué no debemos abrir cualquier URL

La variable `XODO_FRONTEND_URL` es configurable porque Angular puede ocupar 4200, 4202 u otro puerto. Pero aceptar una URL arbitraria sería un mal diseño de seguridad.

`resolveFrontendUrl()` admite solo:

```text
http://127.0.0.1:PUERTO/
http://localhost:PUERTO/
```

No admite direcciones en Internet, `file://`, contraseñas en la URL ni rutas arbitrarias. Esta validación se comprueba mediante las pruebas Node.

**Ejercicio:** antes de ejecutar Electron, establece temporalmente:

```powershell
$env:XODO_FRONTEND_URL = 'https://example.com:443'
pnpm start
```

El programa debe **rechazar la configuración**, no abrir el sitio externo. Luego elimina la variable o restablécela a localhost. Este es un caso de prueba de **fallo esperado**.

## 8. `preload.cjs` — aprender IPC sin abrir privilegios

Electron ejecuta el código de su proceso principal separado del contenido Angular. A veces la interfaz necesita saber si se abrió como aplicación de escritorio.

En nuestro ejemplo:

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('xodoDesktop', {
  getInfo: () => ipcRenderer.invoke('xodo:get-info'),
});
```

Esto añade a la ventana Angular una función de solo lectura:

```typescript
const info = await window.xodoDesktop?.getInfo();
console.log(info);
```

El proceso principal registra un manejador `ipcMain.handle('xodo:get-info', ...)` que devuelve nombre, versión, plataforma y versión de Electron **solo si** la solicitud proviene de nuestro origen local esperado.

**Por qué no exponemos `ipcRenderer` completo o `require`:** una API genérica permitiría enviar mensajes arbitrarios desde la interfaz, dificultaría auditar permisos y podría terminar dando acceso a funciones sensibles. Solo se ofrece una operación concreta y sin efectos sobre hardware.

### Integración opcional con Angular

La copia completa de referencia incluye una mejora **opcional**, no necesaria para tu código actual:

- `frontend/src/app/core/desktop/desktop-bridge.d.ts` describe el tipo de `window.xodoDesktop`.
- `app.ts` detecta si existe el puente (`desktopMode`).
- `app.html` muestra `Ventana Electron` o `Vista de navegador`.

No necesitas copiar esos cambios para probar Electron. La ventana puede cargar exactamente tu Angular actual.

## 9. `backend.cjs` — ¿Electron puede iniciar Spring Boot?

**Sí, de forma opcional.** Esto es una capacidad diferente de crear la ventana, por eso está separada en otro archivo.

El flujo elegido es:

```text
Electron inicia
  |
  v
GET http://127.0.0.1:8082/api/health
  |
  +-- Responde XodoPrinter esperado --> REUTILIZAR; NO CERRARLO AL SALIR
  |
  +-- Responde otro servicio --------> ERROR DE CONFIGURACION
  |
  +-- No hay respuesta
          |
          +-- XODO_BACKEND_JAR no definido --> FRONTEND FUNCIONA, MOTOR OFFLINE
          |
          +-- XODO_BACKEND_JAR definido
                |
                v
           spawn('java', ['-jar', rutaJar, '--server.port=8082'])
                |
           Espera la salud del backend
                |
           Si Electron lo abrio, Electron lo cierra
```

Esto evita una situación peligrosa: **cerrar por accidente un proceso Java que no pertenece a Electron**. El código conserva `owned: true/false` para distinguir la propiedad del proceso.

### ¿Qué es `spawn()`?

`spawn()` es una función de Node.js para iniciar otro programa. En este caso crea el proceso JVM. El comando se construye con **argumentos separados** y `shell: false`, sin concatenar cadenas para ejecutarlas en un intérprete de comandos.

Por ejemplo, internamente equivale a:

```powershell
java -jar "C:\MiProyecto\target\xodoprinter-0.2.0-SNAPSHOT.jar" --server.address=127.0.0.1 --server.port=8082
```

El proceso principal escucha su salida estándar, verifica `/api/health`, y al salir llama `stop()` **solo si** lo lanzó él.

### Práctica opcional del modo administrado

Conserva el frontend Angular abierto. Detén **solo tu backend Java de desarrollo** mediante `Ctrl+C` en su terminal. Empaqueta el JAR en la carpeta que contenga `pom.xml`:

```powershell
mvn clean package
```

Ubica el archivo `.jar` generado dentro de `target/` y establece su ruta completa, por ejemplo:

```powershell
$env:XODO_BACKEND_JAR = 'C:\ruta\a\tu\proyecto\target\xodoprinter-0.2.0-SNAPSHOT.jar'
cd desktop
pnpm start
```

La ruta anterior es **ilustrativa**: verifica dónde existe realmente tu JAR, ya que podría llamarse de otra forma o estar en `backend/target/`.

Ahora Electron intentará iniciar Java automáticamente y consultará su estado. Al cerrar la aplicación terminará su proceso Java hijo. Si detecta que XodoPrinter **ya está abierto**, lo reutilizará y no lo cerrará.

**Limitación del ejercicio:** el puerto 8082 debe coincidir con el proxy Angular. El backend no está autenticado y no se está empaquetando un JRE; por eso esto **no es aún un mecanismo de producción**.

## 10. ¿Por qué sigue habiendo una API HTTP en una app de escritorio?

La separación es deliberada:

- Angular se ocupa de la experiencia del operador.
- Electron de la ventana, integración con Windows y ciclo de vida.
- Spring Boot de los casos de uso y reglas del motor.
- El futuro adaptador USB debe quedar aislado de los controladores HTTP y de la vista.

Que todo se ejecute en el mismo ordenador **no exige** poner la lógica Java dentro de Electron. HTTP local es una manera clara de conectar procesos y facilita depurarlos por separado. En la versión final añadiremos autenticación de sesión entre procesos, límites y permisos, y un puerto dinámico.

## 11. Pruebas y verificación

Desde `desktop/`:

```powershell
pnpm test
```

Incluimos cuatro pruebas que verifican:

1. La URL local de Angular se acepta y normaliza.
2. Las direcciones externas y esquemas peligrosos se rechazan.
3. La navegación queda limitada al mismo origen.
4. El backend solo se considera el esperado cuando devuelve los campos de investigación.

También prueba:

```powershell
Invoke-RestMethod http://127.0.0.1:8082/api/health
```

Y el recorrido manual completo: iniciar Spring -> iniciar Angular -> iniciar Electron -> seleccionar PRN sintético -> analizar -> observar `3`, `2`, `4`, `72 bytes`.

Si cierras Angular, la ventana de desarrollo puede dejar de cargar correctamente: **es normal** porque todavía depende del servidor de desarrollo. Cuando empaquetemos, eliminaremos esa dependencia del servidor Angular.

## 12. Errores frecuentes

| Síntoma | Causa probable | Qué revisar |
|---|---|---|
| Aparece `Angular no responde` | `pnpm start` no se ejecuta o puerto distinto | Dirección real impresa por Angular; configura `XODO_FRONTEND_URL` |
| Angular abre pero dice `Motor Java desconectado` | Java no está escuchando o proxy incorrecto | `/api/health`, puerto 8082, `src/proxy.conf.json` |
| HTTP 502 al analizar | Proxy no puede contactar Java | Reinicia Angular después de corregir proxy |
| `Electron failed to install correctly` | Binario Electron todavía no descargado o instalación incompleta | Reintenta la descarga oficial, revisa salida de `pnpm start` y conectividad |
| `Another service is using backend port` | El puerto 8082 lo ocupa otro proceso | Identifica el proceso. No mates procesos desconocidos |
| `XODO_BACKEND_JAR` no existe | Ruta incorrecta o no ejecutaste `mvn package` | Abre el contenido de `target/` y usa ruta exacta |
| Se abre una segunda ventana pero no una nueva instancia | Bloqueo de instancia única | Es el comportamiento esperado |
| Cambios en Angular no aparecen | Angular dev server no recompiló o se detuvo | Terminal `frontend/`, refresca la ventana Electron |

## 13. ¿Por qué todavía no hacemos el instalador `.exe`?

Una aplicación instalable real debe iniciar con doble clic, **sin necesidad de arrancar manualmente** `pnpm`, Node, Maven, Java o un servidor Angular. Nuestra versión 0.4 todavía carga un servidor de desarrollo y utiliza una API local sin autenticación entre procesos.

Plan técnico para la siguiente etapa:

1. Compilar Angular para distribución y servir sus recursos mediante un esquema local seguro de Electron (no depender de `ng serve`).
2. Empaquetar un runtime Java privado y un JAR validado.
3. Lanzar Java con puerto dinámico, credenciales efímeras por sesión y restricciones de origen/permisos. Evitar exponer métodos privilegiados por IPC sin validación.
4. Incorporar supervisión de procesos, registro de errores y cierre seguro.
5. Crear un instalador Windows con herramienta de empaquetado y, antes de distribuir, revisar firma de código, permisos y pruebas en otra computadora.
6. Mantener la investigación USB separada: todavía no disponemos de un controlador físico validado ni debemos instalar controladores de terceros en la computadora de producción.

## 14. Ejercicios para afianzar la clase

**Ejercicio A — Entender procesos:** escribe con tus palabras quién hace cada cosa cuando el usuario pulsa `Analizar archivo`. Menciona ventana, formulario, API, servicio y lector PRN.

**Ejercicio B — Fallo controlado:** detén temporalmente tu backend Java de desarrollo y vuelve a consultar su estado desde la interfaz. ¿Desaparece la ventana? ¿Qué componente falla realmente?

**Ejercicio C — Detectar la plataforma:** en la referencia completa, revisa `window.xodoDesktop`. ¿Por qué existe dentro de Electron y no cuando ejecutas Angular en Chrome? ¿Qué pasaría si expusiéramos `require` directamente a Angular?

**Ejercicio D — Aislamiento:** verifica en `main.cjs` que `nodeIntegration` sea `false`, `contextIsolation` sea `true` y `sandbox` sea `true`. No cambies esas opciones.

**Ejercicio E — Responsabilidad sobre procesos:** inicia Spring Boot antes de Electron y cierra Electron. ¿Debe terminarse Java? **No**, porque Electron no creó ese proceso. Prueba solo con tu entorno de desarrollo.

## 15. Lo que ya está comprobado y lo que está pendiente

- Los archivos Java/Angular de referencia proceden de la versión 0.3 que ya utilizaste para comunicar con Spring Boot; el ajuste 0.4 alinea sus puertos con **8082/4202**.
- Los archivos JavaScript de `desktop/` se verifican sintácticamente y las pruebas Node se ejecutan en este entorno.
- La interfaz `BrowserWindow` no pudo abrirse aquí porque este entorno no cuenta con el binario Electron para Windows ni con una sesión gráfica de Windows 11. Debes comprobarla en tu computadora.
- No se empaquetó `.exe`; no se implementó transporte USB físico ni envío de raster a la máquina.

---

**Lecturas oficiales:** [Electron: BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window), [Electron: seguridad](https://www.electronjs.org/docs/latest/tutorial/security), [Electron: preload](https://www.electronjs.org/docs/latest/tutorial/tutorial-3-preload), [Angular: proxy de desarrollo](https://angular.dev/tools/cli/serve), [Electron: releases](https://releases.electronjs.org/), [pnpm 11: approve-builds](https://pnpm.io/es/11.x/cli/approve-builds).
