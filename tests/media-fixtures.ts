import { crc32 } from "node:zlib";

// Generated test images: the container structure of a phone photo (metadata segments around the picture
// data), with an invented GPS position. The picture data is filler, which the metadata stripping copies
// without reading. All values are fictional.

export const GPS_MARK = "GPS-59.3293N-18.0686E";

const u16 = (n: number) => [n >> 8, n & 0xff];
const segment = (marker: number, data: Uint8Array | number[]) => Buffer.from([0xff, marker, ...u16(data.length + 2), ...data]);
const text = (value: string) => [...Buffer.from(value, "latin1")];

/** EXIF with an orientation, a GPS IFD pointer and the GPS mark in a string tag (big-endian TIFF). */
export function exifSegment(orientation = 1): Buffer {
  const mark = Buffer.from(`${GPS_MARK}\0`, "latin1");
  // IFD0 at 8: Orientation, GPS pointer (0x8825) and ImageDescription pointing at the mark.
  const entries = 3;
  const ifdEnd = 8 + 2 + entries * 12 + 4;
  const tiff = Buffer.concat([
    Buffer.from([0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 8]),
    Buffer.from([...u16(entries)]),
    Buffer.from([0x01, 0x12, 0x00, 0x03, 0, 0, 0, 1, ...u16(orientation), 0, 0]),
    Buffer.from([0x01, 0x0e, 0x00, 0x02, 0, 0, 0, mark.length, 0, 0, ...u16(ifdEnd)]),
    Buffer.from([0x88, 0x25, 0x00, 0x04, 0, 0, 0, 1, 0, 0, ...u16(ifdEnd + mark.length)]),
    Buffer.from([0, 0, 0, 0]),
    mark,
    // A GPS IFD with GPSLatitudeRef "N".
    Buffer.from([0, 1, 0x00, 0x01, 0x00, 0x02, 0, 0, 0, 2, 0x4e, 0, 0, 0, 0, 0, 0, 0]),
  ]);
  return segment(0xe1, [...text("Exif\0\0"), ...tiff]);
}

/** The parts of a JPEG that make up the picture: tables, frame, scan with stuffed bytes and a restart marker, end. */
export function jpegPicture(width = 640, height = 480) {
  const dqt = segment(0xdb, [0, ...Array.from({ length: 64 }, (_, i) => (i % 50) + 1)]);
  const sof = segment(0xc0, [8, ...u16(height), ...u16(width), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  const dht = segment(0xc4, [0, 0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  const sos = segment(0xda, [3, 1, 0, 2, 0x11, 3, 0x11, 0, 63, 0]);
  const scan = Buffer.from([0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd0, 0x78, 0x9a, 0xff, 0x00, 0xbc]);
  return { dqt, sof, dht, sos, scan, eoi: Buffer.from([0xff, 0xd9]) };
}

/** A phone-style JPEG: JFIF, EXIF with GPS, XMP, IPTC, ICC, a comment, the picture, and an appended second image with its own EXIF. */
export function phoneJpeg({ orientation = 1, width = 640, height = 480 } = {}): Buffer {
  const picture = jpegPicture(width, height);
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    segment(0xe0, [...text("JFIF\0"), 1, 1, 0, 0, 1, 0, 1, 0, 0]),
    exifSegment(orientation),
    segment(0xe1, text(`http://ns.adobe.com/xap/1.0/\0<x:xmpmeta><exif:GPSLatitude>${GPS_MARK}</exif:GPSLatitude></x:xmpmeta>`)),
    segment(0xed, text(`Photoshop 3.0\x008BIM\x04\x04\0\0\0\0\0\x10${GPS_MARK}`)),
    segment(0xe2, text("ICC_PROFILE\0\x01\x01fictional-profile")),
    segment(0xe2, text(`MPF\0${GPS_MARK}`)),
    segment(0xfe, text(`Comment ${GPS_MARK}`)),
    picture.dqt, picture.sof, picture.dht, picture.sos, picture.scan, picture.eoi,
    // The second image a phone appends (a depth or gain map), with its own metadata.
    Buffer.from([0xff, 0xd8]), exifSegment(), Buffer.from([0xff, 0xd9]),
  ]);
}

const pngChunk = (type: string, data: Buffer) => {
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([length, body, crc]);
};

export function pngParts(width = 320, height = 200) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return {
    ihdr: pngChunk("IHDR", ihdr),
    iccp: pngChunk("iCCP", Buffer.from("fictional\0\0profile", "latin1")),
    idat: pngChunk("IDAT", Buffer.from([0x78, 0x9c, 0x63, 0x60, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01])),
    iend: pngChunk("IEND", Buffer.alloc(0)),
  };
}

/** A PNG with text, XMP, EXIF and time chunks that name the GPS mark, and data after the end. */
export function metadataPng(): Buffer {
  const parts = pngParts();
  return Buffer.concat([
    Buffer.from("\x89PNG\r\n\x1a\n", "latin1"), parts.ihdr, parts.iccp,
    pngChunk("tEXt", Buffer.from(`Location\0${GPS_MARK}`, "latin1")),
    pngChunk("iTXt", Buffer.from(`XML:com.adobe.xmp\0\0\0\0\0${GPS_MARK}`, "latin1")),
    pngChunk("zTXt", Buffer.from(`Comment\0\0${GPS_MARK}`, "latin1")),
    pngChunk("eXIf", exifSegment().subarray(10)),
    pngChunk("tIME", Buffer.from([0x07, 0xea, 11, 22, 10, 0, 0])),
    parts.idat, parts.iend,
    Buffer.from(GPS_MARK, "latin1"),
  ]);
}

const webpChunk = (type: string, data: Buffer) => {
  const size = Buffer.alloc(4);
  size.writeUInt32LE(data.length);
  return Buffer.concat([Buffer.from(type, "latin1"), size, data, data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
};

export function webpParts(width = 400, height = 300) {
  const vp8x = Buffer.alloc(10);
  vp8x[0] = 0x20 | 0x08 | 0x04; // ICC, EXIF and XMP announced
  vp8x.writeUIntLE(width - 1, 4, 3);
  vp8x.writeUIntLE(height - 1, 7, 3);
  const frame = Buffer.from([0x50, 0x01, 0x00, 0x9d, 0x01, 0x2a, width & 0xff, width >> 8, height & 0xff, height >> 8, 1, 2, 3]);
  return { vp8x: webpChunk("VP8X", vp8x), iccp: webpChunk("ICCP", Buffer.from("fictional-profile")), vp8: webpChunk("VP8 ", frame) };
}

export function metadataWebp(): Buffer {
  const parts = webpParts();
  const body = Buffer.concat([
    parts.vp8x, parts.iccp, parts.vp8,
    webpChunk("EXIF", exifSegment().subarray(10)),
    webpChunk("XMP ", Buffer.from(`<x:xmpmeta>${GPS_MARK}</x:xmpmeta>`)),
  ]);
  const header = Buffer.alloc(12);
  header.write("RIFF", 0, "latin1");
  header.writeUInt32LE(body.length + 4, 4);
  header.write("WEBP", 8, "latin1");
  return Buffer.concat([header, body]);
}
