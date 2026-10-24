# XodoPrinter: migracion guiada a Spring Boot (seis pasos)

> Edicion educativa basada en la base PRN 0.1 y las cuatro pruebas JUnit que ya aprobaste.
> **Esta carpeta es un proyecto de referencia nuevo. No reemplaza automaticamente tu directorio de trabajo.**
> **NO imprime. NO abre USB. NO se debe usar como controlador industrial.**

## Antes de empezar: que conservar y que cambiar

La base 0.1 ya tenia `PrnInfo`, `PrnInspector`, `PrinterTransport`, `SimulatedPrinterTransport` y `App`.
Durante las clases agregaste `PrnAnalysisService`, `PrnAnalysisResult` y cuatro pruebas. Todo eso se mantiene.

**La diferencia importante:** la capa HTTP no es el motor de impresion. Spring Boot sirve peticiones,
el servicio organiza el trabajo, el inspector interpreta la cabecera y la implementacion de transporte
podra variar sin modificar la API. En esta fase **no existe** la implementacion USB.

```text
Electron/Angular [aun no implementados]
           |
           | HTTP local (fase de desarrollo)
           v
PrnAnalysisController (web)   HealthController (web)
           |
           v
PrnAnalysisService (caso de uso)
           |
           v
PrnInspector + PrnInfo (lectura binaria, independientes de Spring)
           |
           v
PrnAnalysisResult (DTO JSON)

SimulatedPrinterTransport: permanece separado, solo CLI/simulacion.
```

### Requisitos de tu equipo

- Windows 11, JDK 21 o superior. Con tu JDK 25 compila con objetivo Java 21.
- Maven 3.9.x; IntelliJ IDEA (la edicion Community es suficiente).
- Acceso a Maven Central para descargar dependencias en el primer `mvn test`.
- No necesitamos Electron, Angular, la PC Windows 7 ni el dongle para esta migracion.

**Antes de mezclar cambios con tu repositorio:** crea una rama Git (`git switch -c feature/spring-boot-api`)
y verifica que no tienes cambios sin guardar (`git status`). Puedes abrir este ZIP como proyecto
independiente y comparar paquetes antes de copiar nada.

---

## Paso 1. Adaptar `pom.xml`

El nuevo `pom.xml` usa el parent `spring-boot-starter-parent` **4.1.2** y dos dependencias:

- `spring-boot-starter-webmvc`: servidor HTTP local, Spring MVC y serializacion JSON.
- `spring-boot-starter-webmvc-test` (scope `test`): JUnit + pruebas Spring MVC con MockMvc.

En Spring Boot 4 la dependencia MVC se llama `spring-boot-starter-webmvc`, no es necesario
introducir el antiguo `spring-boot-starter-web`. Usamos `<java.version>21</java.version>` por
compatibilidad: JDK 25 puede compilar fuentes destinadas a Java 21.

El plugin `spring-boot-maven-plugin` empaqueta un JAR ejecutable con dependencias y declara
explicitamente `XodoPrinterApplication` como punto de entrada; asi `App` sigue siendo util
para los comandos CLI originales. El parent administra tambien versiones de plugins Maven.

**Comprueba**: `mvn -version` y luego `mvn test`.

## Paso 2. Crear `XodoPrinterApplication.java`

```java
@SpringBootApplication
public class XodoPrinterApplication {
    public static void main(String[] args) {
        SpringApplication.run(XodoPrinterApplication.class, args);
    }
}
```

`@SpringBootApplication` activa configuracion automatica y busqueda de componentes dentro
`twdev.xodoprinter` y sus subpaquetes. Spring registra `PrnAnalysisService` porque esta
anotado con `@Service`, y encuentra los controladores por `@RestController`.

**NO borres** `App.java`: los antiguos `--self-test`, `--inspect`, `--simulate` y
`--inspect-zip` siguen siendo utiles para investigacion sin HTTP.

- CLI antiguo: `java -cp target/classes twdev.xodoprinter.App --self-test`
- API con Spring: `mvn spring-boot:run`
- JAR despues de `mvn package`: `java -jar target/xodoprinter-0.2.0-SNAPSHOT.jar`

> Es normal que el comando CLI con `java -cp target/classes` no incluya las bibliotecas
> Spring: esas rutas del codigo son deliberadamente Java puro y no requieren Spring.

## Paso 3. Crear `HealthController.java`

El metodo `health()` recibe `GET /api/health` y devuelve un `Map`.
Spring transforma el `Map` en JSON:

```json
{
  "status": "UP",
  "service": "xodoprinter",
  "mode": "RESEARCH_ONLY",
  "hardwareAccess": false
}
```

**No confundas** `status: UP` con una impresora conectada. Indica exclusivamente
que funciona la API Java. El booleano `hardwareAccess=false` lo recuerda.

Configurar `server.address=127.0.0.1` hace que el servidor escuche en la misma
computadora. Esta restriccion es necesaria pero **no suficiente** para seguridad:
otras aplicaciones locales tambien pueden hacer solicitudes. Antes de distribuir Electron
anadiremos un secreto efimero por sesion/IPC, puerto dinamico y autorizacion.

## Paso 4. Iniciar y comprobar el endpoint

En terminal 1, situada en la raiz del proyecto:

```powershell
mvn spring-boot:run
```

En terminal 2:

```powershell
Invoke-RestMethod http://127.0.0.1:8765/api/health
```

Si prefieres navegador, abre `http://127.0.0.1:8765/api/health`.

Fijate en el recorrido: cliente HTTP -> servidor Spring -> `HealthController.health()`
-> conversion a JSON -> respuesta HTTP 200. No se ejecuta `PrinterTransport`.

Deten el servidor en su terminal mediante `Ctrl+C`.

## Paso 5. Preservar y ejecutar las pruebas JUnit

`src/test/java/.../application/PrnAnalysisServiceTest.java` contiene **las cuatro**
pruebas previamente aprobadas:

1. Archivo PRN valido de 72 bytes, incluyendo conversion al DTO.
2. Rechazo de extension `.txt`.
3. Rechazo de una cabecera de menos de 48 bytes.
4. Copia inmodificable de advertencias en `PrnAnalysisResult`.

La version tambien incorpora tres pruebas de `analyzeUpload()` y cinco pruebas de API con
`@SpringBootTest` y `@AutoConfigureMockMvc`: en total **12 pruebas definidas**.

```powershell
mvn clean test
```

Para Spring Boot 4, el import nuevo es:

```java
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
```

No confundas este import con el antiguo de Spring Boot 3. MockMvc ejecuta peticiones
simuladas contra los controladores sin iniciar el servidor de red. Tampoco abre USB.

**Si una prueba falla:** lee la primera causa real en la consola. No saltes la prueba
ni uses `-DskipTests` para ocultarla. Abre el informe dentro de `target/surefire-reports`.

## Paso 6. `PrnAnalysisController`: primera API con un caso de uso real

### Solicitud

`POST /api/prn/analyze` con `multipart/form-data`, campo `file`.

El controlador recibe bytes, **no** una ruta como `C:\\Users\\...` proporcionada por
el cliente. No permitimos que una pagina maliciosa solicite directamente la lectura
de archivos arbitrarios del equipo.

```text
HTTP multipart (archivo PRN)
     |
     v
PrnAnalysisController
     |
     v
PrnAnalysisService.analyzeUpload(nombreOriginal, InputStream)
     |
     +- normaliza el nombre a su basename
     +- verifica la extension `.prn`
     +- guarda temporalmente los bytes
     +- rechaza cabeceras menores de 48 bytes
     +- llama al viejo analyze(Path) -> PrnInspector
     +- convierte a PrnAnalysisResult
     +- elimina el archivo temporal siempre (finally)
     |
     v
Spring serializa PrnAnalysisResult en JSON
```

### Probar con el PRN sintetico incluido

Este proyecto contiene `samples/synthetic-valid-3x2.prn` **creado artificialmente**.
No es un trabajo real ni debe enviarse nunca a la maquina.

Con Spring arrancado, desde la raiz del proyecto en PowerShell:

```powershell
curl.exe -X POST "http://127.0.0.1:8765/api/prn/analyze" -F "file=@samples/synthetic-valid-3x2.prn"
```

Respuesta esperada (el orden de campos puede variar):

```json
{
  "fileName": "synthetic-valid-3x2.prn",
  "fileSize": 72,
  "widthCandidate": 3,
  "heightCandidate": 2,
  "channelCountCandidate": 4,
  "recognized": true,
  "warnings": []
}
```

**Los nombres `Candidate` son deliberados.** Provienen de la regla de longitud
observada en un conjunto limitado de archivos PRN de prueba, no de una especificacion
confirmada. No deduzcas dimensiones en milimetros ni parametros de maquina.

### Errores del endpoint

- Nombre con extension distinta de `.prn`: HTTP 400, `code=INVALID_PRN_REQUEST`.
- PRN con menos de 48 bytes: HTTP 400, `code=INVALID_PRN_REQUEST`.
- Datos no reconocidos pero con cabecera completa: HTTP 200 y `recognized=false`,
  con detalles en `warnings` (el analizador esta describiendo la evidencia).
- Error de lectura/escritura en disco: HTTP 500 sin exponer rutas internas.
- Archivo mayor que el limite de desarrollo: rechazado por Spring (limite: 64 MB).

El limite de 64 MB es solo para pruebas didacticas y debera revisarse para PRN
industriales reales de mayor tamano, asi como el uso del disco temporal.

---

## Preguntas para comprobar que lo entiendes

1. Si cambia el formato JSON, ¿debes modificar `PrnInspector`? ¿Por que?
2. ¿Que diferencia hay entre `GET /api/health` y el estado real del plotter?
3. Si Angular envia `C:\\documentos\\trabajo.prn` como texto, ¿por que no leemos
   directamente esa ruta desde el backend?
4. ¿Que hace `@Service` y como obtiene una instancia el controlador?
5. ¿Por que conservar `App.java` si ahora Spring tiene su propio `main()`?
6. ¿Que sucede con el archivo temporal si `PrnInspector` lanza una excepcion?

## Errores comunes en Windows e IntelliJ

| Problema | Diagnostico |
|---|---|
| `mvn` no reconocido | Revisa Maven y variables `PATH`. |
| `package org.springframework... does not exist` | Reimporta `pom.xml`; comprueba Internet y Maven Central. |
| `@AutoConfigureMockMvc` no se encuentra | Comprueba `spring-boot-starter-webmvc-test` e import de Spring Boot 4. |
| Puerto 8765 en uso | Deten otra ejecucion; en PowerShell usa `Get-NetTCPConnection -LocalPort 8765`. |
| `404` en `/api/health` | Ejecutaste `App`, no `XodoPrinterApplication`, o revisa las rutas. |
| `415` al subir el PRN | Debe ser `multipart/form-data` con campo `file`. |
| `400` al subir el PRN | Revisa nombre `.prn`, tamano >=48 bytes y campo `file`. |
| Error por archivo >64 MB | Ajusta limites conscientemente, no desactives validaciones. |
| IntelliJ ve dos `main()` | Usa `XodoPrinterApplication` para API; `App` para CLI. |

## Lo que NO hemos hecho

- No hemos programado el RIP ni la conversion de imagenes a raster del hardware.
- No sabemos aun todos los comandos USB ni su secuencia segura.
- No hemos instalado controladores Windows 11 ni conectado impresoras.
- No implementamos Angular/Electron ni el secreto de autenticacion de escritorio.
- La existencia de JSON no convierte un PRN en trabajo imprimible en el plotter.

## Proximo hito

Disenar un contrato de comunicacion autenticado entre Electron y Spring Boot y una
pantalla Angular que seleccione un archivo y presente `PrnAnalysisResult`. Primero
verificaremos `mvn clean test` y `curl.exe`, sin tocar la PC productiva Windows 7.
