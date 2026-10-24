package twdev.xodoprinter.prnformat;

import java.util.List;

/**
 * Tentative interpretation of a 48-byte PRN test header.
 * The names width/height/channels are inferred from observed file lengths;
 * their physical meaning and raster layout remain unverified.
 */
public record PrnInfo(String name, long fileSize, long[] rawHeader, long expectedSize) {
    public static final int HEADER_SIZE = 48;

    public PrnInfo {
        rawHeader = rawHeader.clone();
    }

    @Override public long[] rawHeader() { return rawHeader.clone(); }
    public long magic() { return rawHeader[0]; }
    public long xResolutionCandidate() { return rawHeader[1]; }
    public long yResolutionCandidate() { return rawHeader[2]; }
    public long widthCandidate() { return rawHeader[3]; }
    public long heightCandidate() { return rawHeader[4]; }
    public long channelCountCandidate() { return rawHeader[7]; }
    public boolean startsWithExpectedMagic() { return magic() == 0x5555L; }
    public boolean matchesObservedLengthRule() { return expectedSize >= 0 && fileSize == expectedSize; }
    public boolean structurallyRecognized() { return startsWithExpectedMagic() && matchesObservedLengthRule(); }

    public List<String> warnings() {
        var items = new java.util.ArrayList<String>();
        if (!startsWithExpectedMagic()) items.add("Unknown PRN magic (expected 0x00005555)");
        if (expectedSize < 0) items.add("Length formula overflow or zero-sized dimensions");
        else if (fileSize != expectedSize) items.add("File length does not follow the observed formula");
        if (channelCountCandidate() != 4 && channelCountCandidate() != 6 && channelCountCandidate() != 8)
            items.add("Unexpected channel count for the provided test corpus");
        return List.copyOf(items);
    }
}
