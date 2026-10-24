package twdev.xodoprinter.api;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import twdev.xodoprinter.application.PrnAnalysisService;
import twdev.xodoprinter.application.dto.PrnAnalysisResult;

import java.io.IOException;
import java.io.InputStream;

/** Acepta uploads PRN; NO acepta rutas arbitrarias del sistema de archivos. */
@RestController
@RequestMapping("/api/prn")
public final class PrnAnalysisController {
    private final PrnAnalysisService service;

    public PrnAnalysisController(PrnAnalysisService service) {
        this.service = service;
    }

    @PostMapping(path = "/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public PrnAnalysisResult analyze(@RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("El archivo no puede estar vacio");
        }
        try (InputStream stream = file.getInputStream()) {
            return service.analyzeUpload(file.getOriginalFilename(), stream);
        }
    }
}
