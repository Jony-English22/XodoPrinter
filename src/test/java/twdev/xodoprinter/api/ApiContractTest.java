package twdev.xodoprinter.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Pruebas de controlador Spring MVC SIN iniciar conexiones con un plotter. */
@SpringBootTest
@AutoConfigureMockMvc
class ApiContractTest {

    @Autowired
    MockMvc mvc;

    static byte[] validFixture() {
        ByteBuffer b = ByteBuffer.allocate(72).order(ByteOrder.LITTLE_ENDIAN);
        int[] fields = {0x5555, 360, 360, 3, 2, 0, 0, 4, 0, 0, 0, 0};
        for (int value : fields) b.putInt(value);
        return b.array();
    }

    @Test
    void shouldReportApiHealthButNotHardwareReady() throws Exception {
        mvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.service").value("xodoprinter"))
                .andExpect(jsonPath("$.hardwareAccess").value(false));
    }

    @Test
    void shouldAnalyzeUploadedPrn() throws Exception {
        var upload = new MockMultipartFile(
                "file", "trabajo01.prn", "application/octet-stream", validFixture());

        mvc.perform(multipart("/api/prn/analyze").file(upload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fileName").value("trabajo01.prn"))
                .andExpect(jsonPath("$.fileSize").value(72))
                .andExpect(jsonPath("$.widthCandidate").value(3))
                .andExpect(jsonPath("$.heightCandidate").value(2))
                .andExpect(jsonPath("$.channelCountCandidate").value(4))
                .andExpect(jsonPath("$.recognized").value(true));
    }

    @Test
    void shouldRejectBadExtensionWithHttp400() throws Exception {
        var upload = new MockMultipartFile(
                "file", "prohibido.txt", "text/plain", validFixture());

        mvc.perform(multipart("/api/prn/analyze").file(upload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_PRN_REQUEST"));
    }

    @Test
    void shouldRejectTruncatedPrnWithHttp400() throws Exception {
        var upload = new MockMultipartFile(
                "file", "roto.prn", "application/octet-stream", new byte[]{0x55, 0x55});

        mvc.perform(multipart("/api/prn/analyze").file(upload))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldDescribeUnrecognizedDataWithoutPrinting() throws Exception {
        byte[] badMagic = validFixture();
        badMagic[0] = 0; badMagic[1] = 0;
        var upload = new MockMultipartFile(
                "file", "desconocido.prn", "application/octet-stream", badMagic);

        mvc.perform(multipart("/api/prn/analyze").file(upload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recognized").value(false))
                .andExpect(jsonPath("$.warnings[0]").exists());
    }
}
