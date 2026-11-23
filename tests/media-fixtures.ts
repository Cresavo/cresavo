import { crc32, deflateSync } from "node:zlib";

// Generated test images: the container structure of a phone photo (metadata segments around the picture
// data), with an invented GPS position. The picture data is filler, which the rebuild copies without
// decoding it. All values are fictional.

/** 21 characters: also used as the pixels of a 7×1 JFIF thumbnail. */
export const GPS_MARK = "GPS-59.3293N-18.0686E";

const u16 = (n: number) => [n >> 8, n & 0xff];
export const segment = (marker: number, data: Uint8Array | number[]) => Buffer.from([0xff, marker, ...u16(data.length + 2), ...data]);
const text = (value: string) => [...Buffer.from(value, "latin1")];

/** A small ICC profile: its header declares its own size and carries the `acsp` signature. */
export function iccProfile(): Buffer {
  const profile = Buffer.alloc(160);
  profile.writeUInt32BE(profile.length, 0);
  profile.write("acsp", 36, "latin1");
  profile.write("fictional-profile", 128, "latin1");
  return profile;
}

/** EXIF with an orientation, a GPS IFD pointer and the GPS mark in a string tag (big-endian TIFF). */
export function exifSegment(orientation = 1): Buffer {
  const mark = Buffer.from(`${GPS_MARK}\0`, "latin1");
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
    Buffer.from([0, 1, 0x00, 0x01, 0x00, 0x02, 0, 0, 0, 2, 0x4e, 0, 0, 0, 0, 0, 0, 0]),
  ]);
  return segment(0xe1, [...text("Exif\0\0"), ...tiff]);
}

/** The parts of a JPEG that make up the picture: tables, frame, scan with stuffed bytes and a restart marker, end. */
export function jpegPicture(width = 640, height = 480, components = 3) {
  const dqt = segment(0xdb, [0, ...Array.from({ length: 64 }, (_, i) => (i % 50) + 1)]);
  const frameComponents = Array.from({ length: components }, (_, i) => [i + 1, i ? 0x11 : 0x22, 0]).flat();
  const sof = segment(0xc0, [8, ...u16(height), ...u16(width), components, ...frameComponents]);
  const dht = segment(0xc4, [0, 0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  const sos = segment(0xda, [components, ...Array.from({ length: components }, (_, i) => [i + 1, 0x11]).flat(), 0, 63, 0]);
  const scan = Buffer.from([0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd0, 0x78, 0x9a, 0xff, 0x00, 0xbc]);
  return { dqt, sof, dht, sos, scan, eoi: Buffer.from([0xff, 0xd9]) };
}

/** JFIF with a 7×1 thumbnail whose pixels spell the GPS mark. */
export const jfifWithThumbnail = () => segment(0xe0, [...text("JFIF\0"), 1, 1, 1, 0, 72, 0, 72, 7, 1, ...text(GPS_MARK)]);
/** The two ICC chunks of `iccProfile()`. */
export function iccSegments(): Buffer[] {
  const profile = iccProfile();
  return [profile.subarray(0, 100), profile.subarray(100)].map((part, n) => segment(0xe2, [...text("ICC_PROFILE\0"), n + 1, 2, ...part]));
}
/** Adobe APP14, colour transform 1, followed by bytes no decoder needs. */
export const adobeSegment = (transform = 1) => segment(0xee, [...text("Adobe"), 0, 100, 0, 0, 0, 0, transform, ...text(GPS_MARK)]);
/** A C2PA manifest in a JUMBF box (APP11), with the GPS mark. */
export const c2paSegment = () => segment(0xeb, [...text("JP"), 0, 1, 0, 0, 0, 1, 0, 0, 0, 40, ...text("jumbc2pa"), ...text(GPS_MARK)]);

/** A phone-style JPEG with every kind of metadata around the picture, and an appended second image with its own EXIF. */
export function phoneJpeg({ orientation = 1, width = 640, height = 480 } = {}): Buffer {
  const picture = jpegPicture(width, height);
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    jfifWithThumbnail(),
    exifSegment(orientation),
    segment(0xe1, text(`http://ns.adobe.com/xap/1.0/\0<x:xmpmeta><exif:GPSLatitude>${GPS_MARK}</exif:GPSLatitude></x:xmpmeta>`)),
    segment(0xed, text(`Photoshop 3.0\x008BIM\x04\x04\0\0\0\0\0\x10${GPS_MARK}`)),
    ...iccSegments(),
    segment(0xe2, text(`MPF\0${GPS_MARK}`)),
    adobeSegment(),
    c2paSegment(),
    segment(0xfe, text(`Comment ${GPS_MARK}`)),
    picture.dqt, picture.sof, picture.dht, picture.sos, picture.scan, picture.eoi,
    Buffer.from([0xff, 0xd8]), exifSegment(), Buffer.from([0xff, 0xd9]),
  ]);
}

export const pngChunk = (type: string, data: Buffer) => {
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([length, body, crc]);
};
export const PNG_SIGNATURE = Buffer.from("\x89PNG\r\n\x1a\n", "latin1");

export function pngParts(width = 320, height = 200) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return {
    ihdr: pngChunk("IHDR", ihdr),
    iccp: pngChunk("iCCP", Buffer.concat([Buffer.from("fictional\0\0", "latin1"), deflateSync(iccProfile())])),
    idat: pngChunk("IDAT", Buffer.from([0x78, 0x9c, 0x63, 0x60, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01])),
    iend: pngChunk("IEND", Buffer.alloc(0)),
  };
}

/** A PNG with text, XMP, EXIF, time, a C2PA manifest (caBX) and other ancillary chunks, and data after the end. */
export function metadataPng(): Buffer {
  const parts = pngParts();
  return Buffer.concat([
    PNG_SIGNATURE, parts.ihdr, parts.iccp,
    pngChunk("tEXt", Buffer.from(`Location\0${GPS_MARK}`, "latin1")),
    pngChunk("iTXt", Buffer.from(`XML:com.adobe.xmp\0\0\0\0\0${GPS_MARK}`, "latin1")),
    pngChunk("zTXt", Buffer.from(`Comment\0\0${GPS_MARK}`, "latin1")),
    pngChunk("eXIf", exifSegment().subarray(10)),
    pngChunk("tIME", Buffer.from([0x07, 0xea, 11, 22, 10, 0, 0])),
    pngChunk("caBX", Buffer.from(`jumbc2pa${GPS_MARK}`, "latin1")),
    pngChunk("pHYs", Buffer.from([0, 0, 0x0b, 0x13, 0, 0, 0x0b, 0x13, 1])),
    parts.idat, parts.iend,
    Buffer.from(GPS_MARK, "latin1"),
  ]);
}

export const webpChunk = (type: string, data: Buffer) => {
  const size = Buffer.alloc(4);
  size.writeUInt32LE(data.length);
  return Buffer.concat([Buffer.from(type, "latin1"), size, data, data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
};

export function riff(...chunks: Buffer[]): Buffer {
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write("RIFF", 0, "latin1");
  header.writeUInt32LE(body.length + 4, 4);
  header.write("WEBP", 8, "latin1");
  return Buffer.concat([header, body]);
}

export function vp8x(width: number, height: number, flags = 0x20 | 0x08 | 0x04) {
  const data = Buffer.alloc(10);
  data[0] = flags;
  data.writeUIntLE(width - 1, 4, 3);
  data.writeUIntLE(height - 1, 7, 3);
  return webpChunk("VP8X", data);
}

export function webpParts(width = 400, height = 300) {
  const frame = Buffer.from([0x50, 0x01, 0x00, 0x9d, 0x01, 0x2a, width & 0xff, width >> 8, height & 0xff, height >> 8, 1, 2, 3]);
  return { vp8x: vp8x(width, height), iccp: webpChunk("ICCP", iccProfile()), vp8: webpChunk("VP8 ", frame) };
}

/** A WebP with EXIF, XMP and a C2PA manifest, all announced in VP8X. */
export function metadataWebp(): Buffer {
  const parts = webpParts();
  return riff(
    parts.vp8x, parts.iccp, parts.vp8,
    webpChunk("EXIF", exifSegment().subarray(10)),
    webpChunk("XMP ", Buffer.from(`<x:xmpmeta>${GPS_MARK}</x:xmpmeta>`)),
    webpChunk("C2PA", Buffer.from(`jumbc2pa${GPS_MARK}`, "latin1")),
  );
}

/** A real, decodable PNG of one colour, with a text chunk naming the GPS mark. Each `seed` is another picture. */
export function realPng(width = 24, height = 16, seed = 0): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) row.set([(seed * 37) & 0xff, (seed * 11 + 90) & 0xff, 160], 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    PNG_SIGNATURE, pngChunk("IHDR", ihdr),
    pngChunk("tEXt", Buffer.from(`Location\0${GPS_MARK}`, "latin1")),
    pngChunk("IDAT", deflateSync(raw)), pngChunk("IEND", Buffer.alloc(0)),
  ]);
}
