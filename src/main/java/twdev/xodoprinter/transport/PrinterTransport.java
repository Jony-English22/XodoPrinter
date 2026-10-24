package twdev.xodoprinter.transport;

import twdev.xodoprinter.prnformat.PrnInfo;

/** Contrato actual: solo simulacion, no controlador USB. */
public interface PrinterTransport extends AutoCloseable {
    enum State { DISCONNECTED, READY, SIMULATING }
    String name();
    State state();
    void connect();
    void simulatePrint(PrnInfo job);
    @Override void close();
}
