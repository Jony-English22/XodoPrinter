package twdev.xodoprinter;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** Punto de entrada del backend HTTP local. NO abre conexiones USB. */
@SpringBootApplication
public class XodoPrinterApplication {

    public static void main(String[] args) {
        SpringApplication.run(XodoPrinterApplication.class, args);
    }
}
