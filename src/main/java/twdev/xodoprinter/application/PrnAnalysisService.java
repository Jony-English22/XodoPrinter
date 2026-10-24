package twdev.xodoprinter.application;

import org.springframework.stereotype.Service;
import twdev.xodoprinter.application.dto.PrnAnalysisResult;
import twdev.xodoprinter.prnformat.PrnInfo;
import twdev.xodoprinter.prnformat.PrnInspector;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;

/** Orquesta el caso de uso. El inspector binario no depende de Spring. */
@Service
public final class PrnAnalysisService {

    // Metodo que ya conoces: se mantiene para CLI y las pruebas originales.
    public PrnInfo analyze(Path file) throws IOException {
        if (file == null || !Files.isRegularFile(file)) {
            throw new IOException("El archivo no existe o no es un archivo normal");
        }
        String name = file.getFileName().toString().toLowerCase(Locale.ROOT);
        if (!name.endsWith(".prn")) {
            throw new IllegalArgumentException("Se esperaba un archivo .prn");
        }
        return PrnInspector.inspect(file);
    }

    // Metodo nuevo: un cliente HTTP envia CONTENIDO, no una ruta a archivos del PC.
    public PrnAnalysisResult analyzeUpload(String originalName, InputStream content) throws IOException {
        String safeName = PrnAnalysisResult.fileNameOnly(originalName);
        if (!safeName.toLowerCase(Locale.ROOT).endsWith(".prn")) {
            throw new IllegalArgumentException("Solo se permiten archivos .prn");
        }
        if (content == null) {
            throw new IllegalArgumentException("El contenido del archivo esta vacio");
        }

        Path temp = Files.createTempFile("xodoprinter-upload-", ".prn");
        try {
            Files.copy(content, temp, StandardCopyOption.REPLACE_EXISTING);
            if (Files.size(temp) < PrnInfo.HEADER_SIZE) {
                throw new IllegalArgumentException("El PRN necesita una cabecera de al menos 48 bytes");
            }
            PrnInfo info = analyze(temp);
            return PrnAnalysisResult.from(info, safeName);
        } finally {
            Files.deleteIfExists(temp);
        }
    }
}
