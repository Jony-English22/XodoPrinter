package twdev.xodoprinter.application.dto;

import twdev.xodoprinter.prnformat.PrnInfo;

import java.util.List;

/** Datos publicos de analisis. No expone la cabecera interna completa. */
public record PrnAnalysisResult(
        String fileName,
        long fileSize,
        long widthCandidate,
        long heightCandidate,
        long channelCountCandidate,
        boolean recognized,
        List<String> warnings
) {
    public PrnAnalysisResult {
        warnings = List.copyOf(warnings);
    }

    public static PrnAnalysisResult from(PrnInfo info) {
        return from(info, info.name());
    }

    public static PrnAnalysisResult from(PrnInfo info, String originalName) {
        // Acepta separadores Windows y Unix; jamas devolvemos rutas completas del usuario.
        String base = fileNameOnly(originalName);
        return new PrnAnalysisResult(
                base, info.fileSize(), info.widthCandidate(), info.heightCandidate(),
                info.channelCountCandidate(), info.structurallyRecognized(), info.warnings()
        );
    }

    public static String fileNameOnly(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("El archivo no tiene nombre");
        }
        String normalized = name.replace('\\', '/');
        String base = normalized.substring(normalized.lastIndexOf('/') + 1);
        if (base.isBlank() || base.equals(".") || base.equals("..")) {
            throw new IllegalArgumentException("Nombre de archivo invalido");
        }
        return base;
    }
}
