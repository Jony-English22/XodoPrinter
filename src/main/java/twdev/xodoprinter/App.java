package twdev.xodoprinter;

import twdev.xodoprinter.application.PrnAnalysisService;
import twdev.xodoprinter.application.dto.PrnAnalysisResult;
import twdev.xodoprinter.prnformat.PrnInfo;
import twdev.xodoprinter.prnformat.PrnInspector;
import twdev.xodoprinter.transport.PrinterTransport;
import twdev.xodoprinter.transport.SimulatedPrinterTransport;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Files;
import java.nio.file.Path;

/** Herramientas de consola independientes de Spring y sin acceso a hardware. */
public final class App {
    private App() {}

    public static void main(String[] args) throws Exception {
        if (args.length == 2 && args[0].equals("--inspect")) {
            describe(new PrnAnalysisService().analyze(Path.of(args[1])));
        } else if (args.length == 2 && args[0].equals("--inspect-zip")) {
            var files = PrnInspector.inspectTestPrnsInZip(Path.of(args[1]));
            long recognized = files.stream().filter(PrnInfo::structurallyRecognized).count();
            System.out.printf("Recognized %d/%d offline TestPRN files%n", recognized, files.size());
            files.stream().filter(p -> !p.structurallyRecognized()).forEach(App::describe);
        } else if (args.length == 2 && args[0].equals("--simulate")) {
            var p = new PrnAnalysisService().analyze(Path.of(args[1]));
            describe(p);
            try (PrinterTransport sim = new SimulatedPrinterTransport()) {
                sim.connect();
                sim.simulatePrint(p);
            }
        } else if (args.length == 1 && args[0].equals("--self-test")) {
            selfTest();
        } else {
            System.out.println("XodoPrinter 0.2 - RESEARCH ONLY - NO REAL PRINTING");
            System.out.println("For Spring Boot API: mvn spring-boot:run");
            System.out.println("--inspect <file.prn>      Inspect without printing");
            System.out.println("--inspect-zip <copy.zip>  Inspect TestPRN entries offline");
            System.out.println("--simulate <file.prn>     Simulate without hardware");
            System.out.println("--self-test               Create and inspect a synthetic PRN");
        }
    }

    private static void describe(PrnInfo p) {
        System.out.printf("%s%n  File length: %d%n  Header length: 48%n  Magic: 0x%08x%n"
                + "  Width? %d  Height? %d  Channels? %d%n  Expected length: %d%n  Recognized: %s%n",
                p.name(), p.fileSize(), p.magic(), p.widthCandidate(), p.heightCandidate(),
                p.channelCountCandidate(), p.expectedSize(), p.structurallyRecognized());
        for (var warning : p.warnings()) System.out.println("  WARNING: " + warning);
    }

    private static void selfTest() throws Exception {
        Path temp = Files.createTempFile("xodoprinter-fixture-", ".prn");
        try {
            ByteBuffer b = ByteBuffer.allocate(48 + 3 * 2 * 4).order(ByteOrder.LITTLE_ENDIAN);
            b.putInt(0x5555);
            b.putInt(360); b.putInt(360); b.putInt(3); b.putInt(2);
            b.putInt(0); b.putInt(0); b.putInt(4);
            b.putInt(0); b.putInt(0); b.putInt(0); b.putInt(0);
            b.position(b.capacity());
            Files.write(temp, b.array());

            PrnInfo p = new PrnAnalysisService().analyze(temp);
            if (!p.structurallyRecognized()) throw new AssertionError("Synthetic PRN was not recognized");
            PrnAnalysisResult dto = PrnAnalysisResult.from(p);

            System.out.println("=== ANALISIS PRN ===");
            System.out.println("Archivo: " + dto.fileName());
            System.out.println("Tamano: " + dto.fileSize() + " bytes");
            System.out.println("Ancho candidato: " + dto.widthCandidate());
            System.out.println("Alto candidato: " + dto.heightCandidate());
            System.out.println("Canales candidatos: " + dto.channelCountCandidate());
            System.out.println("Reconocido: " + dto.recognized());
            System.out.println("Advertencias: " + dto.warnings());
            System.out.printf("SERVICE: %d x %d, channels=%d, valid=%s%n",
                    p.widthCandidate(), p.heightCandidate(), p.channelCountCandidate(), p.structurallyRecognized());

            try (PrinterTransport printer = new SimulatedPrinterTransport()) {
                System.out.println("Estado inicial: " + printer.state());
                printer.connect();
                System.out.println("Estado conectado: " + printer.state());
                printer.simulatePrint(p);
                System.out.println("Estado final: " + printer.state());
            }
            System.out.println("SELF-TEST PASSED (hardware untouched).");
        } finally {
            Files.deleteIfExists(temp);
        }
    }
}
