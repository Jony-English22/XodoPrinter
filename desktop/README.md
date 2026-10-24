# XodoPrinter Desktop 0.4 (Electron)

**Modo desarrollo / laboratorio exclusivamente.** Abre el frontend Angular dentro de una ventana de Windows. No instala controladores USB, no imprime ni modifica el plotter o la PC de produccion.

## Requisitos y puertos de esta clase

- Angular ya esta disponible en `http://127.0.0.1:4202/` (puede configurarse con `XODO_FRONTEND_URL`).
- Spring Boot responde en `http://127.0.0.1:8082/api/health`.
- Node compatible con Angular 22, pnpm 11, Windows 11 x64.
- Electron fijado a 45.0.0 para poder reproducir la practica.

## Primer arranque (backend ya iniciado manualmente)

Abre tres terminales **en tu propio repositorio**:

```powershell
# Terminal 1: desde el proyecto con pom.xml
mvn spring-boot:run

# Terminal 2: desde frontend/
pnpm start

# Terminal 3: desde desktop/
pnpm install
pnpm test
pnpm start
```

Si Angular utiliza otro puerto:

```powershell
$env:XODO_FRONTEND_URL = 'http://127.0.0.1:4200'
pnpm start
```

`desktop/` no necesita cambios al `frontend/` para abrir la ventana: solo requiere que Angular ya funcione. En la referencia completa se agrego una etiqueta visual opcional a Angular para distinguir la ventana Electron del navegador.

## Alternativa: iniciar el JAR Java desde Electron (opcional)

1. Cierra el backend iniciado manualmente (solo el de desarrollo, nunca la PC Windows 7).
2. Genera el JAR en tu proyecto Maven: `mvn clean package`.
3. Indica la ruta **exacta** del JAR desde la terminal `desktop/`:

```powershell
$env:XODO_BACKEND_JAR = 'C:\ruta\a\tu\target\xodoprinter-0.2.0-SNAPSHOT.jar'
pnpm start
```

Electron comprobará `/api/health`; si XodoPrinter ya esta corriendo en 8082, lo reutilizara **sin cerrarlo**. Solo si no existe y has configurado `XODO_BACKEND_JAR`, Electron iniciara un proceso Java propio con puerto 8082 y lo terminara cuando salga la app. El JAR puede tener otro nombre o version: indica su ruta real.

## Archivos para estudiar

- `src/main.cjs`: entrada Electron y ciclo de vida de la ventana.
- `src/config.cjs`: valida la direccion Angular; solo acepta loopback.
- `src/preload.cjs`: puente IPC minimo (`window.xodoDesktop.getInfo()`), aislado del frontend.
- `src/backend.cjs`: comprueba el backend local; opcionalmente inicia y termina un JAR del proyecto.
- `test/config.test.cjs`: 4 pruebas de configuracion y restricciones.

Guia completa: `../docs/CLASE_10_ELECTRON_ES.md`.

## Limites deliberados

- Electron 0.4 abre un **servidor Angular de desarrollo**. Aun **no** carga los archivos Angular empaquetados ni crea un instalador `.exe`.
- La API de laboratorio en loopback todavia no implementa autenticacion por sesion. No distribuyas esto a clientes ni lo expongas en redes.
- La version final debera incluir Angular compilado, JRE privado, backend iniciado en puerto dinamico con autenticacion entre procesos y un protocolo de UI seguro.
- `GET /api/health` significa que responde Java, no que exista comunicacion fisica con el plotter.
