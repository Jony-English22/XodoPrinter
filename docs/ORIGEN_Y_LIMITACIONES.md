# Procedencia de la base 0.2 y limitaciones

La version entregada se recreo desde la base **Flyjet Studio 0.1** previamente
compartida, adaptando su package original `dev.flyjetstudio` a `twdev.xodoprinter`
segun el nombre que usas en tu IntelliJ. Se incorporaron las clases y pruebas
que desarrollaste en la conversacion:

- PrnAnalysisService (validacion y coordinacion)
- PrnAnalysisResult (DTO inmutable)
- Pruebas iniciales de lectura, extension, cabecera y advertencias

Se agregaron Spring Boot 4.1.2 y los nuevos controladores REST.
**No se dispone de una copia exacta de los archivos modificados en tu equipo.**
Compara cuidadosamente contra tu version local y transfiere los cambios sin
sobrescribir tu trabajo automaticamente.

El analisis sigue siendo una hipotesis de formato. El indicador `recognized`
comprueba dos propiedades observadas (magic 0x5555 y longitud esperada), no una
validacion completa de comandos de impresion. No existe acceso USB ni RIP.
