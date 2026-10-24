# XodoPrinter — Clase 13 (parche incremental sobre la versión 0.5)

**Objetivo:** incluir un runtime Java propio y preparar un directorio/instalador experimental para Windows 11 x64. Angular, Spring Boot y el analizador PRN existentes **no se modifican**.

## Integración

1. Guarda tus cambios en Git.
2. Copia únicamente `desktop/` del ZIP encima de la carpeta `desktop/` del repositorio **revisando diferencias** en `main.cjs`, `backend.cjs`, `bundle.cjs` y `package.json`.
3. En `desktop/` ejecuta `pnpm install` y `pnpm test`.
4. Usa un JDK de **Windows x64** con `jlink` y `jmods` (recomendamos tu JDK 25).
5. Comprueba que existen las compilaciones `frontend/dist/...` y `target/*.jar` o `backend/target/*.jar`.
6. En `desktop/` ejecuta `pnpm package:prepare` y después `pnpm package:dir`.
7. Abre `desktop/dist-installer/win-unpacked/XodoPrinterLab.exe` y verifica el análisis del PRN sintético.
8. Solo para pruebas locales y **opcional**: `pnpm package:installer:lab`.

## Límites

- Solo laboratorio: API local sin autenticación por sesión; puerto fijo 8082.
- No imprimir, no comunicar USB, no distribuir a clientes.
- No requiere modificar la PC Windows 7 de producción ni archivos propietarios PrintExp.
- **No se generó un `.exe` aquí:** las herramientas para empaquetar Windows y el JDK Windows x64 se ejecutan en tu computadora. La prueba de Node no sustituye la prueba de Windows.

Consulta la guía: `docs/CLASE_13_RUNTIME_JAVA_E_INSTALADOR_ES.md`.

## Git en Windows

El código que lee archivos PRN usa el paquete `twdev.xodoprinter.prnformat`.
La carpeta se llama `prnformat` porque `PRN` es un nombre reservado de Windows,
también en minúsculas. Usar una carpeta llamada `prn` hacía que `git add -A`
fallara con `No such file or directory` al intentar abrir `PrnInfo.java`,
aunque PowerShell sí pudiera leerlo.

Referencia: [reglas de nombres de archivos y directorios de Microsoft](https://learn.microsoft.com/es-es/windows/win32/fileio/naming-a-file).

El remoto `origin` apunta a `https://github.com/Jony-English22/XodoPrinter.git`.
Para que `git push` configure automáticamente el seguimiento de `main` en la
primera publicación, se habilita esta opción solo en el repositorio local:

```powershell
git config --local push.autoSetupRemote true
git push
```

La opción ya está preparada en esta copia del proyecto. Los archivos generados,
las dependencias, las configuraciones privadas y los PRN reales se excluyen con
`.gitignore`; el PRN sintético de `samples/` sí forma parte del proyecto.
