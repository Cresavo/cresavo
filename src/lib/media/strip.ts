import type { MediaType } from "./sniff";

// Removes the metadata a photo carries (EXIF with its GPS position and camera serial, XMP, IPTC, comments,
// timestamps) by rewriting the container's segments. The picture data is copied byte for byte and never
// re-encoded, so the image looks exactly as before:
//
// - JPEG: every APPn segment goes except JFIF (APP0), the ICC colour profile (APP2) and Adobe's colour
//   transform flag (APP14), which decide how the colours look. Comments go, and so does anything after the
//   end of the main image (the extra pictures a phone appends, such as a depth or gain map, with their own
//   metadata). A photo that should be shown rotated gets a new EXIF block holding only that orientation, or a
//   phone picture taken upright would show on its side.
// - PNG: text chunks (tEXt, zTXt, iTXt), eXIf and the time stamp (tIME) go.
// - WebP: the EXIF and XMP chunks go, and VP8X stops announcing them.
//
// A file whose structure does not add up is refused rather than passed on.

export class CorruptImageError extends Error {
  constructor() {
    super("The image structure is not valid");
  }
}

const fail = (): never => { throw new CorruptImageError(); };
const ascii = (bytes: Uint8Array, start: number, length: number) =>
  start + length <= bytes.length ? String.fromCharCode(...bytes.subarray(start, start + length)) : "";
const u16be = (bytes: Uint8Array, at: number) => (bytes[at] << 8) | bytes[at + 1];

// ---------------------------------------------------------------------------- JPEG

const KEPT_APP: Record<number, string> = { 0xe0: "JFIF\0", 0xe2: "ICC_PROFILE\0", 0xee: "Adobe" };

/** The EXIF orientation (1–8) of an APP1 segment's data, or 1 when it has none. */
export function exifOrientation(data: Uint8Array): number {
  if (ascii(data, 0, 6) !== "Exif\0\0") return 1;
  const tiff = data.subarray(6);
  const order = ascii(tiff, 0, 2);
  if (order !== "II" && order !== "MM") return 1;
  const little = order === "II";
  const u16 = (at: number) => (at + 2 <= tiff.length ? (little ? tiff[at] | (tiff[at + 1] << 8) : u16be(tiff, at)) : -1);
  const u32 = (at: number) => (at + 4 <= tiff.length ? (little ? (tiff[at] | (tiff[at + 1] << 8) | (tiff[at + 2] << 16)) + tiff[at + 3] * 2 ** 24 : tiff[at] * 2 ** 24 + ((tiff[at + 1] << 16) | (tiff[at + 2] << 8) | tiff[at + 3])) : -1);
  if (u16(2) !== 42) return 1;
  const ifd = u32(4);
  const entries = u16(ifd);
  if (ifd < 8 || entries < 0) return 1;
  for (let n = 0; n < entries; n++) {
    const entry = ifd + 2 + n * 12;
    if (entry + 12 > tiff.length) return 1;
    if (u16(entry) === 0x0112 && u16(entry + 2) === 3) {
      const value = u16(entry + 8);
      return value >= 1 && value <= 8 ? value : 1;
    }
  }
  return 1;
}

/** An APP1 segment whose EXIF holds the orientation and nothing else. */
function orientationSegment(orientation: number): Uint8Array {
  return Uint8Array.from([
    0xff, 0xe1, 0x00, 0x22, // APP1, length 34
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // big-endian TIFF, IFD0 at 8
    0x00, 0x01, // one entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00, // Orientation, SHORT, 1
    0x00, 0x00, 0x00, 0x00, // no next IFD
  ]);
}

/** Where the entropy-coded data that starts at `from` ends: the next marker that is not a stuffed byte or a restart. */
function entropyEnd(bytes: Uint8Array, from: number): number {
  let at = from;
  while (at < bytes.length) {
    if (bytes[at] !== 0xff) { at++; continue; }
    const next = bytes[at + 1];
    if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) { at += 2; continue; }
    if (next === 0xff) { at++; continue; }
    return at;
  }
  return at;
}

export function stripJpeg(bytes: Uint8Array): { bytes: Buffer; orientation: number } {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) fail();
  const parts: Uint8Array[] = [];
  let orientation = 1;
  let at = 2;
  while (at < bytes.length) {
    if (bytes[at] !== 0xff) fail();
    const marker = bytes[at + 1];
    if (marker === undefined) fail();
    if (marker === 0xff) { at++; continue; }
    if (marker === 0xd9) { parts.push(bytes.subarray(at, at + 2)); break; }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { parts.push(bytes.subarray(at, at + 2)); at += 2; continue; }
    if (at + 4 > bytes.length) fail();
    const end = at + 2 + u16be(bytes, at + 2);
    if (u16be(bytes, at + 2) < 2 || end > bytes.length) fail();
    const data = bytes.subarray(at + 4, end);
    if (marker >= 0xe0 && marker <= 0xef) {
      if (marker === 0xe1 && orientation === 1) orientation = exifOrientation(data);
      const signature = KEPT_APP[marker];
      if (signature && ascii(data, 0, signature.length) === signature) parts.push(bytes.subarray(at, end));
    } else if (marker !== 0xfe) {
      parts.push(bytes.subarray(at, end));
    }
    at = end;
    if (marker === 0xda) {
      const scanEnd = entropyEnd(bytes, at);
      parts.push(bytes.subarray(at, scanEnd));
      at = scanEnd;
    }
  }
  // A JFIF APP0 must stay the first segment; the orientation goes right after it.
  if (orientation !== 1) {
    const jfifFirst = parts[0]?.[1] === 0xe0;
    parts.splice(jfifFirst ? 1 : 0, 0, orientationSegment(orientation));
  }
  return { bytes: Buffer.concat([Uint8Array.from([0xff, 0xd8]), ...parts]), orientation };
}

// ---------------------------------------------------------------------------- PNG

const PNG_DROPPED = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME"]);

export function stripPng(bytes: Uint8Array): Buffer {
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  let at = 8;
  for (;;) {
    if (at + 12 > bytes.length) fail();
    const length = ((bytes[at] << 24) >>> 0) + (bytes[at + 1] << 16) + (bytes[at + 2] << 8) + bytes[at + 3];
    const end = at + 12 + length;
    if (end > bytes.length) fail();
    const type = ascii(bytes, at + 4, 4);
    if (!/^[A-Za-z]{4}$/.test(type)) fail();
    if (!PNG_DROPPED.has(type)) parts.push(bytes.subarray(at, end));
    at = end;
    // Anything after the end chunk is not part of the image.
    if (type === "IEND") break;
  }
  return Buffer.concat(parts);
}

// ---------------------------------------------------------------------------- WebP

const WEBP_DROPPED = new Set(["EXIF", "XMP "]);
const VP8X_EXIF = 0x08;
const VP8X_XMP = 0x04;

export function stripWebp(bytes: Uint8Array): Buffer {
  const declared = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
  const total = Math.min(bytes.length, 8 + (declared >>> 0));
  const parts: Uint8Array[] = [];
  let at = 12;
  while (at < total) {
    if (at + 8 > total) fail();
    const type = ascii(bytes, at, 4);
    const size = (bytes[at + 4] | (bytes[at + 5] << 8) | (bytes[at + 6] << 16) | (bytes[at + 7] << 24)) >>> 0;
    const end = at + 8 + size + (size % 2);
    if (at + 8 + size > total) fail();
    if (!WEBP_DROPPED.has(type)) {
      const chunk = Buffer.from(bytes.subarray(at, Math.min(end, total)));
      if (type === "VP8X" && size >= 1) chunk[8] &= ~(VP8X_EXIF | VP8X_XMP);
      // A last chunk of odd size may lack its pad byte; it gets one.
      parts.push(chunk.length < end - at ? Buffer.concat([chunk, Buffer.alloc(1)]) : chunk);
    }
    at = end;
  }
  const body = Buffer.concat(parts);
  const header = Buffer.alloc(12);
  header.write("RIFF", 0, "latin1");
  header.writeUInt32LE(4 + body.length, 4);
  header.write("WEBP", 8, "latin1");
  return Buffer.concat([header, body]);
}

/** The image without its metadata, and the orientation it should be shown in (1 = as stored). */
export function stripMetadata(type: MediaType, bytes: Uint8Array): { bytes: Buffer; orientation: number } {
  if (type === "image/jpeg") return stripJpeg(bytes);
  return { bytes: type === "image/png" ? stripPng(bytes) : stripWebp(bytes), orientation: 1 };
}
