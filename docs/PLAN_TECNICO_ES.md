# XodoPrinter: plan de software propio para Windows 11

**Version del documento:** 0.1 (investigacion inicial)
**Equipo objetivo:** Flyjet WD3200-3225 (modelo por confirmar fisicamente)
**Hardware USB observado:** VID 7856 / PID 0100
**Equipo de produccion:** Windows 7 con PrintExp DX5-lock2 V2.41, NO MODIFICAR
**Equipo de desarrollo:** Windows 11 x64

## Decision de producto

Construir una aplicacion nueva, independiente de PrintExp, que permita gestionar trabajos de impresion con una interfaz clara. El programa anterior solo aporta evidencia para estudiar el formato de trabajos y la comunicacion con la controladora. El objetivo final incluye preparar imagenes (raster/RIP), transmitirlas y verificar fisicamente la impresion; no basta con mostrar una ventana ni abrir un puerto USB.

## Hallazgos estaticos confirmados

### Archivos de la instalacion original

- `PrintExp.exe` es PE32 x86.
- `USB Device Driver/64bit/PrinterDrv.inf` declara `USB\\VID_7856&PID_0100` y un controlador `PrinterDrv.sys` de kernel. La existencia del controlador no confirma soporte en Windows 11.
- `UsbDev2.dll` y `UsbDve3.dll` exportan `CreateObjectUsbDev`, cada uno dispone de implementaciones que importan `DeviceIoControl` y funciones de deteccion de dispositivos.
- `UsbProc.dll` exporta metodos de clase `CUsbSample` cuyos nombres incluyen: `USB_OpenDevice`, `USB_GetDeviceCount`, `USB_ReadState`, `USB_DataRead`, `USB_DataWrite`, `USB_ResetFIFO`, `_USB_VendRequest_REG`, `_USB_VendRequest_SER`.
- `PrinterDevice.dll` expone funciones de control de la maquina, movimientos, lectura de estado y parametros. `PrintProc.dll` contiene codigo relacionado con la preparacion y ejecucion de trabajos.
- Los nombres de simbolos y las importaciones NO bastan para conocer paquetes, endpoints, secuencias, credenciales ni permisos de escritura.

### Formato de los PRN de prueba

Se inspeccionaron 63 archivos `TestPRN/*.prn` sin extraer ni ejecutar nada.

- Todos comienzan con los bytes `55 55 00 00`.
- Todos presentan los primeros 48 bytes interpretables como 12 enteros de 32 bits, little-endian.
- En los 63 casos coincide: `tamano_archivo = 48 + valor_0x0C * valor_0x10 * valor_0x1C`.
- Los valores en `0x1C` observados en el corpus son 4, 6 y 8.
- Interpretacion provisional: dimension horizontal, dimension vertical y canales. No se ha demostrado todavia disposicion de canales, significado de todos los campos o si este formato se transmite tal cual por USB.
- `1Pass_EPSON_8H.prn` y `2Pass_EPSON_16H.prn` son ejemplos que cumplen la regla. **No** deben enviarse directamente a la impresora: su uso actual es solamente de analisis offline.

## Estructura planeada

1. **xodoprinter-desktop**: JavaFX, importacion, vista previa, ajustes legibles, cola, estados, mensajes de error.
2. **xodoprinter-core**: trabajos, reglas, limite de tamanos, estados y bitacora; ninguna accion fisica automatica.
3. **xodoprinter-raster**: render, gestion ICC, tramado, separacion de canales, mapeo de cabezales; aun por investigar.
4. **xodoprinter-protocol**: codificacion/decodificacion de mensajes y estados de controladora; aun por reconstruir.
5. **xodoprinter-transport**: interfaz desacoplada; ahora solo simulador, en el futuro backend de WinUSB/libusb o una alternativa compatible verificada.

## Priorizacion y criterios de aceptacion

### Hito 0: base Java, sin hardware [IMPLEMENTADO]
- Codigo propio Java 25 sin DLL antiguas y sin controlador USB.
- Lector offline de cabeceras PRN.
- Prueba automatizada con PRN sintetico, y validacion del corpus original: 63/63 archivos cumplen estructura y longitud.
- Simulador que acepta metadatos de un trabajo pero NO envia datos ni produce impresiones.

### Hito 1: formato de datos completo [PENDIENTE]
- Diferenciar cabecera, datos de imagen, orden de canales, alineacion y patrones de pasadas.
- Contrastar PRN con BMP de prueba que viene en la instalacion.
- Analizar conservadoramente logs existentes, evitando datos personales y sin ejecutar operaciones de escritura.

### Hito 2: protocolo USB [PENDIENTE]
- Localizar rutas de acceso al dispositivo, identificar los IOCTL y transferencias utilizadas, distinguir lectura de estado de escrituras.
- Consultar documentacion publica relevante para controladoras Cypress/Hoson y confirmar que corresponda a esta implementacion.
- Determinar si WinUSB puede controlar sus interfaces y que requisitos impone la instalacion firmada del driver.
- No copiar binarios propietarios ni eludir protecciones de licencia.

### Hito 3: conexion segura de laboratorio [PENDIENTE]
- Solo sobre un segundo hardware equivalente o dentro de una ventana de mantenimiento previamente autorizada.
- Validar enumeracion e identidad, sin encender movimientos o voltajes.
- Validar primero operaciones de lectura, con desconexion y tiempos de espera controlados.

### Hito 4: primera impresion real [PENDIENTE]
- Validar limites de movimiento, estado de seguridad, cabezales, tinta, medios y parada de emergencia.
- Impresion fisica pequena y controlada con material de descarte, tras autorizacion y presencia de un operador.
- Probar colas, cancelacion, reconexion y recuperacion de errores.

### Hito 5: producto de uso cotidiano [PENDIENTE]
- Vista previa con medidas de impresion, posicion, recorte y escala.
- Perfiles de material y calidad comprensibles, protegidos por configuraciones verificadas.
- Progreso real, errores explicados, historial y cola de trabajos.
- Importacion de formatos comunes (PNG/TIFF/PDF) solo tras definir flujo raster/RIP fiable.

## No confundir

- **Cargar archivo** no es **procesarlo correctamente**.
- **Reconocer USB** no es **enviar instrucciones validas**.
- **Recibir un estado Online** no es **imprimir sin riesgo**.
- **Tener un driver x64** no es **tener driver firmado compatible con Windows 11**.
- **Rehacer la interfaz** es mucho mas sencillo que **reconstruir RIP y control del cabezal**.

## Restricciones y legalidad

La PC Windows 7 en produccion se mantiene intacta. No instalar, desinstalar, reiniciar, desconectar, capturar USB invasivamente ni cambiar calibraciones. Las pruebas se hacen en copias y equipos separados. Respetar las licencias del sistema original; trabajar sobre datos observables con finalidad de interoperabilidad, sin vulnerar la llave USB. Que la llave sea requerida por PrintExp no demuestra que el hardware la requiera.

## Fuentes generales

- WinUSB: https://learn.microsoft.com/en-us/windows-hardware/drivers/usbcon/winusb-considerations
- Instalacion de WinUSB: https://learn.microsoft.com/en-us/windows-hardware/drivers/usbcon/winusb-installation
- Requisitos de firma: https://learn.microsoft.com/en-us/windows-hardware/drivers/install/driver-signing
- Documentacion Windows de libusb: https://github.com/libusb/libusb/wiki/Windows
