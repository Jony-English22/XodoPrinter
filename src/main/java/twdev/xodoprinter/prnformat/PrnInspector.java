package twdev.xodoprinter.prnformat;

import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipFile;

/** Read-only, offline PRN header inspector: never sends commands to a device. */
public final class PrnInspector {
    private PrnInspector() {}

    public static PrnInfo inspect(Path path) throws IOException {
        try (InputStream in = Files.newInputStream(path)) {
            return inspect(path.toString(), Files.size(path), in);
        }
    }

    public static PrnInfo inspect(String name, long length, InputStream input) throws IOException {
        byte[] header = input.readNBytes(PrnInfo.HEADER_SIZE);
        if (header.length != PrnInfo.HEADER_SIZE) throw new IOException("PRN smaller than 48 bytes: " + name);
        ByteBuffer bytes = ByteBuffer.wrap(header).order(ByteOrder.LITTLE_ENDIAN);
        long[] fields = new long[12];
        for (int i = 0; i < fields.length; i++) fields[i] = Integer.toUnsignedLong(bytes.getInt());
        long expected;
        try {
            if (fields[3] == 0 || fields[4] == 0 || fields[7] == 0) throw new ArithmeticException("zero dimension");
            expected = Math.addExact(PrnInfo.HEADER_SIZE,
                Math.multiplyExact(Math.multiplyExact(fields[3], fields[4]), fields[7]));
        } catch (ArithmeticException e) {
            expected = -1;
        }
        return new PrnInfo(name, length, fields, expected);
    }

    public static List<PrnInfo> inspectTestPrnsInZip(Path zipFile) throws IOException {
        List<PrnInfo> result = new ArrayList<>();
        try (ZipFile z = new ZipFile(zipFile.toFile(), java.nio.charset.Charset.forName("IBM437"))) {
            var entries = z.entries();
            while (entries.hasMoreElements()) {
                var e = entries.nextElement();
                if (e.isDirectory()) continue;
                String name = e.getName().replace('\\', '/');
                if (!name.contains("/TestPRN/") || !name.toLowerCase(java.util.Locale.ROOT).endsWith(".prn")) continue;
                try (InputStream input = z.getInputStream(e)) {
                    result.add(inspect(name, e.getSize(), input));
                }
            }
        }
        return List.copyOf(result);
    }
}
