package twdev.xodoprinter.api;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Salud del backend, NO estado de conexion con el plotter. */
@RestController
@RequestMapping("/api")
public final class HealthController {

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of(
                "status", "UP",
                "service", "xodoprinter",
                "mode", "RESEARCH_ONLY",
                "hardwareAccess", false
        );
    }
}
