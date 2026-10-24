package twdev.xodoprinter.api;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.io.IOException;

@RestControllerAdvice
public final class ApiExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiError> invalidInput(IllegalArgumentException ex) {
        return ResponseEntity.badRequest()
                .body(new ApiError("INVALID_PRN_REQUEST", ex.getMessage()));
    }

    @ExceptionHandler(IOException.class)
    public ResponseEntity<ApiError> ioFailure(IOException ex) {
        // No revelar rutas internas ni datos del equipo al navegador.
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiError("FILE_IO_ERROR", "No se pudo leer el archivo solicitado"));
    }
}
