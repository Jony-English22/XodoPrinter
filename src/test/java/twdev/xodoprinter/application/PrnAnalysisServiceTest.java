package twdev.xodoprinter.application;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import twdev.xodoprinter.application.dto.PrnAnalysisResult;
import twdev.xodoprinter.prnformat.PrnInfo;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** Las cuatro pruebas de la etapa anterior, preservadas en la migracion. */
class PrnAnalysisServiceTest {

    @TempDir
    Path tempDir;

    private final PrnAnalysisService service = new PrnAnalysisService();

    static byte[] validFixture() {
        ByteBuffer b = ByteBuffer.allocate(72).order(ByteOrder.LITTLE_ENDIAN);
        int[] header = {0x5555, 360, 360, 3, 2, 0, 0, 4, 0, 0, 0, 0};
        for (int value : header) b.putInt(value);
        return b.array();
    }

    @Test
    void shouldAnalyzeValidPrn() throws IOException {
        Path file = tempDir.resolve("test.prn");
        Files.write(file, validFixture());

        PrnInfo result = service.analyze(file);
        assertTrue(result.structurallyRecognized());
        assertEquals(72, result.fileSize());
        assertEquals(3, result.widthCandidate());
        assertEquals(2, result.heightCandidate());
        assertEquals(4, result.channelCountCandidate());

        PrnAnalysisResult dto = PrnAnalysisResult.from(result);
        assertEquals("test.prn", dto.fileName());
        assertEquals(72, dto.fileSize());
        assertEquals(3, dto.widthCandidate());
        assertEquals(2, dto.heightCandidate());
        assertEquals(4, dto.channelCountCandidate());
        assertTrue(dto.recognized());
    }

    @Test
    void shouldRejectInvalidExtension() throws IOException {
        Path file = tempDir.resolve("test.txt");
        Files.writeString(file, "Contenido de prueba");

        assertThrows(IllegalArgumentException.class, () -> service.analyze(file));
    }

    @Test
    void shouldRejectIncompleteHeader() throws IOException {
        Path file = tempDir.resolve("broken.prn");
        Files.write(file, new byte[]{0x55, 0x55, 0, 0});

        assertThrows(IOException.class, () -> service.analyze(file));
    }

    @Test
    void shouldProtectWarningsFromModification() {
        List<String> warnings = new ArrayList<>();
        warnings.add("Advertencia inicial");

        PrnAnalysisResult result = new PrnAnalysisResult("test.prn", 72, 3, 2, 4, true, warnings);
        warnings.add("Otra advertencia");

        assertEquals(List.of("Advertencia inicial"), result.warnings());
        assertThrows(UnsupportedOperationException.class,
                () -> result.warnings().add("Nueva advertencia"));
    }
}
