# XodoPrinter — Clase 13: runtime Java privado y ejecutable para Windows 11

> **Nivel:** primera distribución de laboratorio. **Estado:** código preparado y pruebas unitarias de Node superadas. La generación del instalador debe comprobarse en tu Windows 11 x64. **Sin impresión física ni acceso USB.**
>
> **No distribuir a clientes todavía:** la API Spring Boot funciona en loopback pero no dispone de autenticación por sesión. El paquete está destinado exclusivamente a pruebas de desarrollo.

## 1. Nuestro objetivo

Ya confirmaste la Clase 12: Electron abre `xodo://app/`, presenta el Angular compilado y puede iniciar Spring Boot desde un JAR. La captura mostró el análisis correcto de `synthetic-valid-3x2.prn`.

Sin embargo, el modo compilado 0.5 tenía una dependencia importante: para ejecutar `java -jar`, Windows debía encontrar `java.exe` en el `PATH`. No queremos exigir ese requisito a quien abra XodoPrinter.

Esta clase modifica el ciclo de vida así:

```text
XodoPrinterLab.exe (Electron)
│
├── resources/app.asar
│   └── src/main.cjs, bundle.cjs, backend.cjs, preload.cjs
│
└── resources/xodo/
    ├── web/
    │   └── index.html, archivos JS/CSS y assets de Angular
    ├── backend/
    │   └── xodoprinter.jar
    └── runtime/
        └── bin/java.exe y módulos Java necesarios
             │
             └── inicia el JAR de Spring Boot en 127.0.0.1:8082
```

En la versión empaquetada, Electron **siempre** usa ese Java privado. Ya no consulta el Java instalado en el equipo. El directorio `runtime` se construye a partir de tu JDK, nunca se descarga dinámicamente al ejecutar la aplicación.

## 2. Conceptos fundamentales

### JDK, JVM y runtime

- **JDK:** conjunto para desarrollar con Java: `javac`, `jlink`, `java`, herramientas de diagnóstico, archivos `jmods`, etc.
- **JVM:** máquina virtual que ejecuta bytecode Java.
- **Runtime privado:** una copia de las piezas necesarias para ejecutar nuestra aplicación. Contiene una JVM y módulos Java, pero no necesariamente herramientas de desarrollo.
- **JAR:** archivo que guarda las clases y recursos de nuestro backend; en nuestro caso Spring Boot crea un JAR ejecutable con sus dependencias.
- **`jlink`:** herramienta del JDK para construir un runtime a partir de módulos escogidos.

En esta clase el JAR **no se convierte a código nativo**. Sigue ejecutándose sobre una JVM, solo que esa JVM viaja dentro de la aplicación Electron.

### ¿Por qué `jlink` en lugar de copiar todo el JDK?

Un JDK completo incluye herramientas de compilación que un usuario no necesita. `jlink` genera un runtime seleccionado a partir del sistema modular de Java (JPMS), reduciendo espacio y dependencias del sistema operativo.

Para empezar usamos una lista de módulos conservadora:

```text
java.se
jdk.unsupported
jdk.crypto.ec
jdk.charsets
jdk.localedata
jdk.management
jdk.zipfs
```

**Importante:** esto no demuestra que sea la lista mínima o definitiva para un futuro motor RIP/USB. Cuando agreguemos nuevas bibliotecas o drivers, debemos repetir pruebas y adaptar los módulos. Un JAR Spring Boot contiene dependencias anidadas y el análisis superficial de su JAR con `jdeps` puede pasar por alto módulos utilizados indirectamente.

### ¿Qué es `app.asar`?

Electron puede guardar el JavaScript de su proceso principal en un archivo `app.asar`. **No guardaremos allí Java ni el JAR**: los colocamos como `extraResources`, fuera de ASAR, porque son recursos ejecutables o de datos que necesitamos abrir como archivos normales.

## 3. Archivos nuevos y modificados

```text
XodoPrinter/
├── pom.xml, target/*.jar                # tu backend actual, no se reemplaza
├── frontend/dist/.../browser/          # tu Angular actual, no se reemplaza
└── desktop/
    ├── package.json                     # agrega electron-builder
    ├── scripts/
    │   ├── stage.cjs                    # copia Angular + JAR, igual que en Clase 12
    │   └── stage-runtime.cjs            # NUEVO: ejecuta jlink
    ├── src/
    │   ├── main.cjs                     # ahora permite app.isPackaged
    │   ├── backend.cjs                  # modo instalado no reutiliza backend existente
    │   ├── bundle.cjs                   # NUEVO: packagedPaths(process.resourcesPath)
    │   ├── config.cjs                   # sin cambios funcionales
    │   └── preload.cjs                  # sin cambios funcionales
    ├── test/
    │   ├── package-runtime.test.cjs     # NUEVO
    │   └── package-backend.test.cjs     # NUEVO
    ├── .staged/                         # se genera; no subir a Git
    └── dist-installer/                  # se genera; no subir a Git
```

Se trata de un **parche solo para `desktop/`**. No reemplaces las clases Java que ya modificaste ni el proyecto Angular que validaste en Windows 11.

Antes de integrar el parche, guarda el estado del proyecto:

```powershell
git status
git add .
git commit -m "feat: xodoprinter 0.5 integrado con electron"
```

Si el repositorio contiene archivos de compilación, comprueba `.gitignore` antes de hacer `git add .`. Nunca subas el software de PrintExp ni binarios propietarios analizados a Git.

## 4. Paso 1 — Validar el JDK de Windows

Abre PowerShell **en tu computadora Windows 11 de desarrollo** (no en la PC Windows 7 conectada al plotter):

```powershell
java -version
where.exe jlink
$env:JAVA_HOME
```

Usa preferentemente el **JDK 25 de Windows x64**. `jlink` necesita encontrar el directorio `jmods` del JDK de Windows. Si `JAVA_HOME` no está configurado, el script intenta localizar `jlink.exe` mediante `where.exe`.

Ejemplo de configuración para esa sesión de PowerShell (ajusta la ruta real, no copies el ejemplo literalmente):

```powershell
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-25'
```

No necesitas instalar ni modificar un JDK nuevo si tu JDK actual ya tiene `bin/jlink.exe` y `jmods/java.base.jmod`.

**¿Por qué se construye en Windows?** `jlink` genera un runtime para el sistema de la distribución del JDK que utilizas. Un JDK de Linux produciría un runtime Linux, no un `java.exe` Windows.

## 5. Paso 2 — Verificar las compilaciones que ya tienes

En la carpeta que contiene el `pom.xml`:

```powershell
mvn clean package
```

En `frontend/`:

```powershell
pnpm build
```

Ya confirmaste estos pasos. **Solo repítelos si cambiaste el código desde la Clase 12.**

El script `stage.cjs` busca automáticamente el JAR ejecutable en `target/` o `backend/target/` y el `index.html` bajo `frontend/dist/`. Si hay más de un JAR posible, no elige uno al azar; mostrará un error para que revises la carpeta.

## 6. Paso 3 — Instalar las herramientas de empaquetado

Después de copiar el parche `desktop/`, ejecuta allí:

```powershell
pnpm install
pnpm test
```

Se agregó `electron-builder` (línea estable 26.x) para generar el directorio Windows o, más adelante, el instalador NSIS. Se conservó Electron 45 porque es la versión que ya comprobaste funcionando.

Si pnpm bloquea un script de instalación, revisa el nombre del paquete y usa `pnpm approve-builds` solamente para los paquetes de construcción en los que confías. **No desactives la validación global de scripts.**

Las pruebas verifican las rutas, las reglas del proxy y el diseño del empaquetado, pero no reemplazan la prueba real de la aplicación Windows.

## 7. Paso 4 — Construir el runtime Java privado

Desde `desktop/`:

```powershell
pnpm package:prepare
```

El comando invoca, en orden:

```text
node scripts/stage.cjs
node scripts/stage-runtime.cjs
```

El primer script copia Angular y el JAR a `.staged/`. El segundo crea `.staged/runtime/` con `jlink`.

La secuencia es importante: `stage.cjs` **elimina y reconstruye** `.staged/`, así que si ejecutaras `jlink` primero, perderías el runtime generado.

Comprueba el resultado:

```powershell
.\.staged\runtime\bin\java.exe -version
.\.staged\runtime\bin\java.exe --list-modules
```

Deberías ver la versión del JDK de origen y los módulos disponibles. Esto es una prueba del runtime, **no** una prueba todavía del JAR Spring Boot.

### Estudio del script `stage-runtime.cjs`

El núcleo es:

```javascript
const result = spawnSync(jlinkExecutable, [
  '--module-path', path.join(jdkHome, 'jmods'),
  '--add-modules', ROOT_MODULES.join(','),
  '--strip-debug', '--no-header-files', '--no-man-pages',
  '--compress=zip-6',
  '--output', output,
], { stdio: 'inherit', windowsHide: true });
```

- `--module-path`: encuentra los módulos del JDK de Windows.
- `--add-modules`: incluye las funcionalidades que decidimos conservar.
- `--strip-debug`, `--no-header-files`, `--no-man-pages`: omiten archivos innecesarios para ejecutar la aplicación.
- `--compress=zip-6`: comprime recursos dentro de la imagen del runtime.
- `--output`: coloca el runtime dentro de `.staged/runtime`.

Se usa `spawnSync` con `shell: false` de forma implícita. No construimos un comando PowerShell concatenando rutas del usuario, así que los espacios en `C:\Users\...` no rompen las rutas.

## 8. Paso 5 — Generar una aplicación Windows desempaquetada

Antes de generar el paquete, **cierra únicamente** la vista previa anterior de XodoPrinter y cualquier instancia de **tu** servidor Spring Boot de pruebas que use 8082. No detengas procesos Java ajenos.

En `desktop/`:

```powershell
pnpm package:dir
```

Este comando ejecuta el staging, crea el runtime y utiliza `electron-builder --dir --win --x64`.

El resultado esperado es una carpeta similar a:

```text
desktop/dist-installer/win-unpacked/
├── XodoPrinterLab.exe
└── resources/
    ├── app.asar
    └── xodo/
        ├── web/index.html
        ├── backend/xodoprinter.jar
        └── runtime/bin/java.exe
```

Abre el ejecutable:

```powershell
.\dist-installer\win-unpacked\XodoPrinterLab.exe
```

Esta es la **primera prueba con la aplicación Windows empaquetada**, todavía sin instalador. Es más fácil diagnosticarla porque puedes inspeccionar los archivos incluidos.

Comprueba lo siguiente:

1. Abre una ventana de XodoPrinter aunque `pnpm start` esté cerrado.
2. Se muestra la interfaz Angular compilada.
3. No aparece una petición para instalar Java.
4. Se inicia el backend en `127.0.0.1:8082`.
5. Al analizar `synthetic-valid-3x2.prn`, se muestran 3 × 2, 4 unidades de canal y 72 bytes.
6. Al cerrar Electron, termina únicamente el proceso Java que abrió.
7. Si hay otra instancia en el puerto 8082, la app empaquetada **rechaza el arranque** y explica el conflicto; no cierra esa instancia ni la reutiliza silenciosamente.

**Nota:** que Java no sea necesario instalarlo es algo que debe comprobarse en una máquina de pruebas limpia. Si Java ya está instalado en tu equipo, la presencia del runtime privado en `resources/xodo/runtime/bin/java.exe` es una señal, pero no la única prueba de independencia.

## 9. Paso 6 — Generar un instalador NSIS de laboratorio (opcional)

**Solo después de comprobar `package:dir`**, puedes ejecutar:

```powershell
pnpm package:installer:lab
```

Obtendrás un archivo similar a:

```text
desktop/dist-installer/XodoPrinter-Laboratorio-0.6.0-Setup.exe
```

Esta versión es **experimental y no está firmada digitalmente**. Windows puede presentar avisos de reputación de aplicaciones para software sin firma. No recomendamos desactivar la protección de Windows para instalar archivos desconocidos. Si haces la prueba, debe ser en tu propia máquina controlada o una máquina virtual/sandbox, con una copia que tú mismo construiste y verificaste.

**No compartas este instalador con clientes ni lo utilices junto al plotter de producción.** Antes de cualquier distribución real debemos implantar autenticación local, evitar puertos fijos, registrar los errores de manera segura, firmar el instalador y comprobar el comportamiento en Windows 11 limpio.

## 10. Lo que cambia en Electron

### `main.cjs`

La opción `app.isPackaged` indica si Electron se está ejecutando como aplicación empaquetada:

```javascript
const builtPreview = app.isPackaged || process.argv.includes('--built');
```

En desarrollo, el comando `pnpm preview:built` continúa funcionando como antes. En el ejecutable empaquetado ya no tienes que pasar `--built`: la propia aplicación elige el modo compilado.

### `bundle.cjs`: rutas diferentes para desarrollo e instalación

```javascript
function packagedPaths(resourcesDirectory) {
  const root = path.join(resourcesDirectory, 'xodo');
  return {
    webRoot: path.join(root, 'web'),
    backendJar: path.join(root, 'backend', 'xodoprinter.jar'),
    runtimeJava: path.join(root, 'runtime', 'bin', 'java.exe'),
  };
}
```

El valor `process.resourcesPath` apunta al directorio `resources` de la aplicación empaquetada. Por eso utilizamos `extraResources` de electron-builder.

### `backend.cjs`: quién es dueño del proceso

En desarrollo, si el backend válido está abierto, Electron puede reutilizarlo sin cerrarlo. En modo instalador de laboratorio, **no se reutiliza una instancia preexistente**: se exige que el puerto esté libre y que Electron inicie su propio Java.

La operación de inicio usa `spawn` y recibe una ruta absoluta al Java privado:

```javascript
spawn(javaPrivado, [
  '-jar', rutaJar,
  '--server.address=127.0.0.1',
  '--server.port=8082',
], { shell: false, windowsHide: true });
```

Se conserva el principio que ya entendiste: Electron no debe terminar procesos Java que no inició.

### `package.json`: configuración de electron-builder

Las entradas `extraResources` especifican qué archivos irán dentro de `resources/xodo`:

```json
[
  { "from": ".staged/web", "to": "xodo/web" },
  { "from": ".staged/backend/xodoprinter.jar", "to": "xodo/backend/xodoprinter.jar" },
  { "from": ".staged/runtime", "to": "xodo/runtime" }
]
```

## 11. Errores frecuentes y cómo diagnosticarlos

| Mensaje o síntoma | Causa probable | Acción |
|---|---|---|
| `No se encontro un JDK` | `JAVA_HOME` incorrecto o falta `jlink.exe` | Comprueba `$env:JAVA_HOME` y `where.exe jlink` |
| `jmods/java.base.jmod` no existe | Se está apuntando a un JRE en lugar de un JDK | Usa el directorio raíz del JDK 25 |
| `Angular no esta compilado` | No existe el `index.html` de `dist` | Ejecuta `pnpm build` en `frontend/` |
| `Se esperaba un JAR` | Maven no generó el JAR o hay varios candidatos | Revisa `target/`, ejecuta `mvn clean package` |
| `Ya hay una instancia ... 8082` | Otro XodoPrinter local está ejecutándose | Cierra solo tu instancia anterior |
| `No se pudo iniciar XodoPrinter` | El backend no arranca o faltan recursos | Revisa que estén JAR, Angular y Java privado en `resources/xodo` |
| `HTTP 502` | El backend no respondió a la API | Revisa el arranque del proceso Java y `/api/health` |
| `java.exe` no encontrado dentro de resources | El runtime no fue empaquetado | Repite `pnpm package:dir` tras corregir `pnpm package:prepare` |
| SmartScreen alerta por el instalador | Binario sin firma/reputación | No eludas protecciones; mantén las pruebas en entorno controlado |

## 12. Pruebas de la clase

Desde `desktop/`:

```powershell
pnpm test
```

El parche contiene las pruebas previas y nuevas pruebas de:

- Módulos y argumentos de `jlink`.
- Localización de un JDK de Windows.
- Rechazo de generación para un sistema o arquitectura incorrectos.
- Rutas de recursos dentro del `.exe`.
- Archivos que electron-builder debe copiar.
- Rechazo de reutilización de un backend abierto en modo empaquetado.

Estas son pruebas de lógica JavaScript. La validación real de `jlink` de Windows, del empaquetado Electron y del instalador **solo se completa al ejecutar los comandos anteriores en Windows**.

## 13. Ejercicio para comprender la arquitectura

Antes de continuar, responde en tus propias palabras:

1. ¿Por qué el JAR Java no debe estar dentro de `app.asar`?
2. ¿Qué diferencia existe entre el Java que tú utilizas para desarrollar y el Java privado que viaja con XodoPrinter?
3. ¿Qué ocurre si abres dos instancias del ejecutable de XodoPrinter?
4. ¿Por qué Electron tiene que conocer el directorio `process.resourcesPath` cuando `app.isPackaged` vale `true`?
5. ¿Por qué seguimos considerando este instalador únicamente de laboratorio aunque ya abra Angular y Java correctamente?

## 14. Qué haremos en la Clase 14

Esta versión alcanza un hito de empaquetado, pero aún falta fortalecer la comunicación local antes de convertirla en producto:

- Configurar un puerto local dinámico en lugar del fijo 8082.
- Crear un token de sesión de alta entropía entre Electron y Spring Boot.
- Evitar que el navegador Angular vea o administre el token.
- Restringir y verificar todas las operaciones HTTP del backend.
- Pruebas de apagado, reinicio, errores, actualizaciones y licencias.
- Preparar firma de código y una estrategia de despliegue segura.

**No conectaremos todavía el USB ni emitiremos comandos al plotter.** La PC Windows 7 de impresión se mantiene intacta.

## 15. Fuentes técnicas

- Oracle: `jlink` — https://docs.oracle.com/en/java/javase/26/docs/specs/man/jlink.html
- electron-builder: `extraResources` y `extraFiles` — https://www.electron.build/v26/docs/contents/
- electron-builder: instaladores NSIS — https://www.electron.build/v26/docs/nsis/
- Electron: esquema personalizado y protocolos — https://www.electronjs.org/docs/latest/api/protocol

> Esta documentación explica el parche preparado para XodoPrinter; no es un certificado de funcionamiento en una instalación limpia de Windows 11 ni una validación del hardware Flyjet.
