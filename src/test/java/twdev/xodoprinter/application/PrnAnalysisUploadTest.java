package twdev.xodoprinter.application;

import org.junit.jupiter.api.Test;
import twdev.xodoprinter.application.dto.PrnAnalysisResult;

import java.io.ByteArrayInputStream;

import static org.junit.jupiter.api.Assertions.*;

/** Nuevas pruebas del metodo que recibira contenido mediante HTTP. */
class PrnAnalysisUploadTest {
    private final PrnAnalysisService service = new PrnAnalysisService();

    @Test
    void shouldReturnOriginalSafeFilenameAndCorrectMetadata() throws Exception {
        var dto = service.analyzeUpload("C:\\Trabajos\\prueba.prn",
                new ByteArrayInputStream(PrnAnalysisServiceTest.validFixture()));
        assertEquals("prueba.prn", dto.fileName());
        assertEquals(72, dto.fileSize());
        assertTrue(dto.recognized());
        assertTrue(dto.warnings().isEmpty());
    }

    @Test
    void shouldRejectShortUpload() {
        assertThrows(IllegalArgumentException.class,
                () -> service.analyzeUpload("broken.prn", new ByteArrayInputStream(new byte[4])));
    }

    @Test
    void shouldRejectOtherExtensionEvenIfBytesLookLikePrn() {
        assertThrows(IllegalArgumentException.class,
                () -> service.analyzeUpload("script.exe",
                        new ByteArrayInputStream(PrnAnalysisServiceTest.validFixture())));
    }
}
