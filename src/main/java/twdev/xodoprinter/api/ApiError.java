package twdev.xodoprinter.api;

/** Respuesta de error estable; no devuelve rutas temporales o trazas internas. */
public record ApiError(String code, String message) {}
