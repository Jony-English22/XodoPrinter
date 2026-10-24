package twdev.xodoprinter.transport;

import twdev.xodoprinter.prnformat.PrnInfo;

/** Simulador virtual. Nunca abre puertos USB ni imprime fisicamente. */
public final class SimulatedPrinterTransport implements PrinterTransport {
    private State state = State.DISCONNECTED;

    @Override public String name() { return "Virtual Flyjet - no hardware access"; }
    @Override public State state() { return state; }
    @Override public void connect() { state = State.READY; }

    @Override
    public void simulatePrint(PrnInfo job) {
        if (state != State.READY) throw new IllegalStateException("Simulator is not connected");
        if (!job.structurallyRecognized()) throw new IllegalArgumentException("Invalid PRN structure");
        state = State.SIMULATING;
        try {
            // Solo procesamos metadatos. NO hay procesamiento de raster ni envio USB.
            System.out.printf("SIMULATOR: accepted %s (%d x %d, %d channel-units)%n",
                    job.name(), job.widthCandidate(), job.heightCandidate(), job.channelCountCandidate());
            System.out.println("SIMULATOR: job completed virtually; NOTHING was printed.");
        } finally {
            state = State.READY;
        }
    }

    @Override public void close() { state = State.DISCONNECTED; }
}
