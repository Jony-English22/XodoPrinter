# XodoPrinter - Clase 12: Angular compilado + JAR Java dentro de Electron

> Etapa: integracion de escritorio para investigacion. No hay impresion fisica ni comunicacion USB.
> Meta pedagogica: comprender que cambia al pasar del entorno de desarrollo a uno ejecutable local.

## 1. Objetivo

Ya ejecutaste con exito: Angular en 4202, Spring Boot en 8082 y Electron como ventana. Tambien compilaste Angular con `pnpm build` y Java con `mvn clean package`.

Ahora queremos **una sola orden para abrir la ventana** y que Electron haga dos cosas automaticamente:

1. Leer la interfaz Angular desde los archivos que produjo la compilacion, sin iniciar Angular CLI.
2. Iniciar el JAR de Spring Boot si no esta ejecutandose, sin iniciar Maven.

Todavia sera necesario tener Java en el equipo: en la siguiente etapa construiremos un runtime privado y un instalador Windows.

## 2. Arquitectura: desarrollo y compilado

### Anterior (desarrollo)

```text
Electron  ---- abre http://127.0.0.1:4202 ----> Angular CLI
                                                    |
                                             /api (proxy CLI)
                                                    v
                                         Spring Boot:8082
```

### Nuevo (vista previa compilada)

```text
Electron  ---- abre xodo://app/ ----> Angular compilado (.staged/web)
   |                                      |
   |                               POST xodo://app/api/prn/analyze
   |                                      |
   | <------ interceptor protocol.handle() + reglas permitidas
   |                                      |
   +---- inicia JAR Java --------> Spring Boot:8082 (127.0.0.1)
                                          |
                                  PrnAnalysisService
                                          |
                                    PrnInspector
```

**No hay un navegador externo, pero Electron contiene Chromium.** `xodo://app/` no es una pagina publica en Internet. Es un esquema personalizado para que la ventana lea archivos empacados.

## 3. Archivos entregados y responsabilidades

```text
XodoPrinter/
|-- pom.xml                      (ya lo tienes)
|-- target/*.jar                 (resultado Maven; puede estar en backend/target)
|-- frontend/
|   |-- dist/xodoprinter-frontend/browser/  (resultado Angular)
|   |-- src/app/core/desktop/desktop-bridge.d.ts (actualizado)
|-- desktop/
|   |-- package.json             (comando preview:built)
|   |-- scripts/stage.cjs        (nueva copia de compilaciones)
|   |-- src/config.cjs           (reconoce el modo local xodo://)
|   |-- src/bundle.cjs           (carga HTML/JS/CSS y puente /api)
|   |-- src/main.cjs             (elige el modo y abre la ventana)
|   |-- src/backend.cjs          (arranca o reutiliza Java)
|   |-- src/preload.cjs          (IPC controlado)
|   |-- test/*.test.cjs          (pruebas de configuracion y seguridad)
|   `-- .staged/                 (generado; NO subir a Git)
|       |-- web/index.html
|       |-- web/*.js, *.css, assets...
|       `-- backend/xodoprinter.jar
```

### `stage.cjs`

Averigua donde Maven guardo el JAR y donde Angular dejo `index.html`.

Busca el JAR en `target/` o `backend/target/`; por tanto sirve si tu proyecto Spring Boot es la raiz del repositorio o si esta en un subdirectorio `backend/`.

Copia ambos resultados a `desktop/.staged/`. **No modifica el codigo fuente de Java ni de Angular.** Si hay varios JAR candidatos detiene la operacion para evitar escoger uno equivocado.

### `main.cjs`

Sigue siendo el punto de entrada de Electron. Su nueva opcion es `--built`:

- Sin `--built`: modo habitual con Angular CLI en localhost:4202.
- Con `--built`: abre `xodo://app/` y usa los archivos compilados.

En el segundo modo tambien indica a `backend.cjs` el JAR que debe arrancar. Electron comprueba `/api/health` antes de mostrar la ventana.

### `backend.cjs`

Se conserva el codigo que ya conoces:

- Consulta `http://127.0.0.1:8082/api/health`.
- Si el backend correcto ya esta activo, lo reutiliza y **no lo termina** cuando Electron cierra.
- Si no esta activo, crea un proceso Java con `spawn(java, ['-jar', jar, ...])`.
- Si el proceso fue creado por Electron, lo cierra al salir.

El nombre `java` se resuelve desde el PATH. Si Java no esta en el PATH, puedes indicar una ruta concreta en `XODO_JAVA`.

### `bundle.cjs`

Aqui resolvemos el problema del antiguo proxy de Angular. Angular sigue solicitando rutas relativas, por ejemplo `POST /api/prn/analyze`, pero ya NO hay un servidor `ng serve` que las redirija.

El nuevo manejador `protocol.handle('xodo', ...)` decide que hacer con cada solicitud:

- `GET xodo://app/` -> `desktop/.staged/web/index.html`.
- `GET xodo://app/main-...js` -> el archivo JavaScript compilado.
- `GET xodo://app/api/health` -> peticion local a `http://127.0.0.1:8082/api/health`.
- `POST xodo://app/api/prn/analyze` -> peticion local a `http://127.0.0.1:8082/api/prn/analyze` con su cuerpo multipart.
- Cualquier otra ruta `/api/` -> rechazo.

El servidor de Java **no recibe la ruta del archivo del usuario**; recibe los bytes del PRN subido y ejecuta el mismo analizador de antes. No se envian comandos USB.

El protocolo comprueba la autoridad `app`, bloquea rutas fuera del directorio de Angular y declara una politica de seguridad de contenido (CSP). Node y Electron se mantienen aislados de Angular; el puente IPC de la clase 11 sigue siendo limitado.

## 4. Preparar el repositorio

Antes de copiar archivos, guarda tus cambios en Git. Es una buena costumbre antes de realizar una integracion importante:

```powershell
git status
git add .
git commit -m "feat: finalizar base Angular y Spring Boot"
```

No copies el ZIP completo encima del repositorio sin revisar los archivos modificados. Solo contiene el parche `desktop/` y una definicion de tipos de `frontend/`. Si hiciste cambios propios en `main.cjs` u otros archivos, combinalos con ayuda del diff de IntelliJ.

No incluyas `desktop/.staged/` en Git porque contiene archivos de compilacion y el JAR. El parche agrega una regla `.gitignore`.

## 5. Primera ejecucion (Windows 11)

### Paso A: detener la ejecucion anterior

Deten **solamente** las terminales de `pnpm start` y `mvn spring-boot:run` de TU copia de desarrollo de XodoPrinter. No termines procesos Java ajenos ni toques la computadora Windows 7 del plotter.

### Paso B: comprobar los resultados anteriores

Dependiendo de donde este el `pom.xml`, el JAR estara en:

```text
XodoPrinter/target/xodoprinter-*.jar
```

o en:

```text
XodoPrinter/backend/target/xodoprinter-*.jar
```

Angular normalmente quedara en:

```text
XodoPrinter/frontend/dist/xodoprinter-frontend/browser/index.html
```

Si cambiaste el nombre del proyecto Angular, `stage.cjs` detecta el `index.html` dentro de `frontend/dist`.

### Paso C: ejecutar el modo compilado

Abre una sola terminal dentro de `XodoPrinter/desktop`:

```powershell
pnpm install
pnpm test
pnpm preview:built
```

El tercer comando hace dos operaciones: primero ejecuta `stage.cjs` y luego inicia `electron . --built`.

Deberias ver mensajes parecidos a:

```text
[stage] Angular: ...\\frontend\\dist\\xodoprinter-frontend\\browser
[stage] Spring Boot: ...\\target\\xodoprinter-0.2.0-SNAPSHOT.jar
[desktop] Iniciando Java desde ...\\desktop\\.staged\\backend\\xodoprinter.jar ...
[desktop] Backend iniciado por Electron y listo.
[desktop] Angular compilado + Java listos. No hace falta pnpm start en frontend.
```

**Resultado esperado**: ventana de XodoPrinter, indicador "Motor Java disponible" y el analisis exitoso de `synthetic-valid-3x2.prn`. No tendras que levantar Angular CLI ni Maven.

### Paso D: prueba del ciclo de vida

Cierra la ventana de Electron. Si Electron habia arrancado Java, deberia terminar ese proceso; si Java ya estaba abierto antes, deberia conservarlo.

Para comprenderlo, estudia el objeto devuelto por `prepareBackend()` y su propiedad `owned`. En el caso propio, `owned=true`.

## 6. Pruebas automatizadas

Dentro de `desktop/`:

```powershell
pnpm test
```

Las pruebas verifican, entre otros puntos:

- Se pueden servir el HTML y el JavaScript construidos.
- El esquema local no confunde `xodo://app` con otros anfitriones o protocolos.
- No se accede a archivos fuera de `.staged/web`.
- El protocolo solamente envia `GET /api/health` y `POST /api/prn/analyze` al backend.
- El cuerpo multipart se transmite completo.
- El IPC se limita al frame principal.
- La preparacion no elimina los archivos del proyecto original.

Las pruebas Node no demuestran que Windows 11 abra correctamente Electron: eso hay que comprobarlo en tu equipo.

## 7. Problemas frecuentes

**"Angular no esta compilado"**: verifica `frontend/dist/.../index.html` y vuelve a ejecutar `pnpm build` dentro de `frontend/`.

**"Se esperaba un JAR ejecutable"**: revisa la carpeta `target/` junto al `pom.xml`. Si hay varios JAR candidatos, deja solo el ejecutable correcto o ajusta el detector antes de continuar.

**"Java termino antes de responder /api/health"**: comprueba `java -version` y ejecuta el JAR manualmente en tu computadora para ver el error de Spring Boot. Detenlo cuando termines.

**"Otro servicio ocupa el puerto 8082"**: cierra exclusivamente tu instancia local anterior de XodoPrinter o identifica que aplicacion usa el puerto. No mates procesos a ciegas.

**"Motor Java desconectado"**: la ventana puede abrir pero la peticion al backend no respondio. Observa la terminal Electron y sus mensajes `[java]`.

**"Archivo PRN no se analiza"**: primero prueba el ejemplo sintetico de 72 bytes. No cambies los binarios de PrintExp ni la PC productiva.

**Angular cambia su interfaz pero Electron muestra la antigua**: repite `pnpm build` en `frontend/` y despues `pnpm preview:built` en `desktop/`. El modo compilado usa una copia de los archivos del ultimo build, no el servidor `pnpm start`.

## 8. Seguridad y limites actuales

Este es un ejercicio de integracion, **no una distribucion segura para clientes**.

- La API Spring Boot escucha solo en `127.0.0.1:8082`, pero **no tiene autenticacion por sesion**. Otro proceso local puede llamarla.
- El puerto 8082 es fijo. Una version distribuida debera manejar colisiones, iniciar su propio backend en un puerto controlado y autenticar las peticiones entre procesos.
- Electron utiliza el JDK/JRE que ya esta instalado en Windows. Todavia **no incluye el runtime Java**.
- Este modo se inicia con `pnpm preview:built`, **no genera un `.exe` instalable**.
- No hay driver, comandos USB, movimientos de motores ni impresion fisica.
- No usar como sustituto del software de produccion del plotter.

## 9. Siguiente clase

Crearemos un runtime Java privado con herramientas del JDK como `jlink` y prepararemos los recursos que un empaquetador de Electron debe incluir. Despues trabajaremos en autenticacion de la API local y pruebas en un Windows 11 limpio antes de considerar un instalador. Solo se distribuira una aplicacion si no depende de software propietario ni modifica el hardware sin validacion.

## 10. Preguntas para comprender

1. Por que necesitamos `protocol.handle()` en el modo compilado, pero no con `ng serve`?
2. Que diferencia hay entre `App.java` y `XodoPrinterApplication.java` cuando Electron inicia Spring Boot?
3. Por que `stage.cjs` **copia** el JAR y no modifica el `pom.xml`?
4. Que sucede si Electron encuentra Spring Boot ya ejecutandose antes de iniciar?
5. Por que una prueba de PRN reconocido no significa que el hardware sea compatible?

Si sabes responderlas, entendiste el cambio principal de esta clase.
