import { crc32, inflateSync } from "node:zlib";
import type { MediaType } from "./sniff";

// Rebuilds an uploaded picture from an allowlist: what a decoder needs to draw it, and its ICC colour
// profile. Everything else is left behind: EXIF with its GPS position, XMP, IPTC, comments, thumbnails
// (including the one a JFIF header may carry), provenance manifests (C2PA, JUMBF, PNG caBX), time stamps
// and the extra pictures a phone appends. The picture data is copied byte for byte, never re-encoded.
//
// - JPEG: the tables, the frame, every scan and the end marker; a minimal JFIF header (no thumbnail) when the
//   file had one; a valid ICC profile; Adobe's colour transform byte for a three- or four-component frame,
//   in a minimal APP14; and, for a rotated photo, an EXIF block holding only the orientation.
// - PNG: IHDR, PLTE, tRNS, IDAT, IEND and the colour chunks (gAMA, cHRM, sRGB, cICP, sBIT, a valid iCCP).
// - WebP: the bitstream (VP8 or VP8L), its alpha (ALPH), a valid ICC profile and a VP8X header rebuilt
//   from them.
//
// Only a complete still image passes: a JPEG needs a frame, a scan and its end marker, a PNG its data and end
// chunk with correct checksums, a WebP a bitstream whose size matches its header. Animated PNG and WebP are
// refused for now. The number of segments is capped and the result is written into one buffer no larger
// than the upload, so a hostile file costs a bounded amount of memory and time.

export class CorruptImageError extends Error {
  constructor() {
    super("The image structure is not valid");
  }
}

export class AnimatedImageError extends Error {
  constructor() {
    super("Animated images are not supported");
  }
}

/** Most JPEG segments (markers outside the scans) or WebP chunks one file may have. */
export const MAX_SEGMENTS = 512;
/** Most PNG chunks: encoders split the image data into many 8 KiB IDAT chunks. */
export const MAX_PNG_CHUNKS = 4096;
/** An ICC profile larger than this is not a colour profile a photo needs. */
const MAX_ICC_BYTES = 1024 * 1024;

function fail(): never {
  throw new CorruptImageError();
}
const ascii = (bytes: Uint8Array, start: number, length: number) =>
  start >= 0 && start + length <= bytes.length ? String.fromCharCode(...bytes.subarray(start, start + length)) : "";
const u16be = (bytes: Uint8Array, at: number) => (bytes[at] << 8) | bytes[at + 1];
const u32be = (bytes: Uint8Array, at: number) => bytes[at] * 2 ** 24 + ((bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]);
const u32le = (bytes: Uint8Array, at: number) => (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16)) + bytes[at + 3] * 2 ** 24;
const u24le = (bytes: Uint8Array, at: number) => bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16);

/** One output buffer, never larger than its capacity. */
class Output {
  private readonly buffer: Buffer;
  private at = 0;
  constructor(capacity: number) {
    this.buffer = Buffer.alloc(capacity);
  }
  write(bytes: Uint8Array | number[]) {
    if (this.at + bytes.length > this.buffer.length) fail();
    this.buffer.set(bytes, this.at);
    this.at += bytes.length;
  }
  done(): Buffer {
    return Buffer.from(this.buffer.subarray(0, this.at));
  }
}

/** True for an ICC profile whose header declares exactly this size and carries the profile signature. */
function validIcc(profile: Uint8Array): boolean {
  return profile.length >= 128 && profile.length <= MAX_ICC_BYTES && u32be(profile, 0) === profile.length && ascii(profile, 36, 4) === "acsp";
}

// ---------------------------------------------------------------------------- JPEG

/** The EXIF orientation (1–8) of an APP1 segment's data, or 1 when it has none. */
export function exifOrientation(data: Uint8Array): number {
  if (ascii(data, 0, 6) !== "Exif\0\0") return 1;
  const tiff = data.subarray(6);
  const order = ascii(tiff, 0, 2);
  if (order !== "II" && order !== "MM") return 1;
  const little = order === "II";
  const u16 = (at: number) => (at >= 0 && at + 2 <= tiff.length ? (little ? tiff[at] | (tiff[at + 1] << 8) : u16be(tiff, at)) : -1);
  const u32 = (at: number) => (at >= 0 && at + 4 <= tiff.length ? (little ? u32le(tiff, at) : u32be(tiff, at)) : -1);
  if (u16(2) !== 42) return 1;
  const ifd = u32(4);
  const entries = u16(ifd);
  if (ifd < 8 || entries < 0) return 1;
  for (let n = 0; n < Math.min(entries, 512); n++) {
    const entry = ifd + 2 + n * 12;
    if (entry + 12 > tiff.length) return 1;
    if (u16(entry) === 0x0112 && u16(entry + 2) === 3) {
      const value = u16(entry + 8);
      return value >= 1 && value <= 8 ? value : 1;
    }
  }
  return 1;
}

const orientationSegment = (orientation: number) => [
  0xff, 0xe1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // APP1, length 34, "Exif\0\0"
  0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, 0x00, 0x01, // big-endian TIFF, IFD0 at 8, one entry
  0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00, // Orientation, SHORT, 1
  0x00, 0x00, 0x00, 0x00, // no next IFD
];

/** JFIF 1.02 with the original's pixel density and no thumbnail. */
const jfifSegment = (units: number, x: number, y: number) => [
  0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x02, units, x >> 8, x & 0xff, y >> 8, y & 0xff, 0x00, 0x00,
];

/** Adobe APP14 with only the colour transform (0 none or CMYK, 1 YCbCr, 2 YCCK). */
const adobeSegment = (transform: number) => [0xff, 0xee, 0x00, 0x0e, 0x41, 0x64, 0x6f, 0x62, 0x65, 0x00, 0x64, 0x00, 0x00, 0x00, 0x00, transform];

/** Markers a decoder needs: frames, tables, restart interval, scans, number of lines. */
const isDecodingMarker = (marker: number) => (marker >= 0xc0 && marker <= 0xcf) || marker === 0xdb || marker === 0xdd || marker === 0xda || marker === 0xdc;
const isFrame = (marker: number) => marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

/** Where the entropy-coded data that starts at `from` ends: the next marker that is not a stuffed byte or a restart. */
function entropyEnd(bytes: Uint8Array, from: number): number {
  let at = from;
  while (at + 1 < bytes.length) {
    if (bytes[at] !== 0xff) { at++; continue; }
    const next = bytes[at + 1];
    if (next === 0x00 || (next >= 0xd0 && next <= 0xd7) || next === 0xff) { at += next === 0xff ? 1 : 2; continue; }
    return at;
  }
  return fail();
}

export function stripJpeg(bytes: Uint8Array): { bytes: Buffer; orientation: number } {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) fail();
  // First pass: where the kept segments are (offsets only, in fixed arrays) and what the rebuilt header needs.
  const starts = new Int32Array(MAX_SEGMENTS);
  const ends = new Int32Array(MAX_SEGMENTS);
  let kept = 0, segments = 0;
  let orientation = 1, jfif: [number, number, number] | null = null, adobe = -1, components = 0, scans = 0, ended = false;
  const icc: { start: number; end: number; seq: number; count: number }[] = [];
  let at = 2;
  while (at < bytes.length) {
    if (bytes[at] !== 0xff || at + 1 >= bytes.length) fail();
    const marker = bytes[at + 1];
    if (marker === 0xff) { at++; continue; }
    if (++segments > MAX_SEGMENTS) fail();
    if (marker === 0xd9) { ended = true; break; }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) fail();
    if (at + 4 > bytes.length) fail();
    const length = u16be(bytes, at + 2);
    const end = at + 2 + length;
    if (length < 2 || end > bytes.length) fail();
    const data = bytes.subarray(at + 4, end);
    if (marker === 0xe0 && !jfif && ascii(data, 0, 5) === "JFIF\0" && data.length >= 12) {
      const units = data[7] <= 2 ? data[7] : 0;
      jfif = [units, u16be(data, 8) || 1, u16be(data, 10) || 1];
    } else if (marker === 0xe1 && orientation === 1) {
      orientation = exifOrientation(data);
    } else if (marker === 0xe2 && ascii(data, 0, 12) === "ICC_PROFILE\0" && data.length > 14 && icc.length < 256) {
      icc.push({ start: at, end, seq: data[12], count: data[13] });
    } else if (marker === 0xee && ascii(data, 0, 5) === "Adobe" && data.length >= 12 && data[11] <= 2) {
      adobe = data[11];
    } else if (isDecodingMarker(marker)) {
      if (isFrame(marker)) {
        if (components || scans) fail();
        components = data[5];
        if (components < 1 || components > 4 || length !== 8 + 3 * components) fail();
      }
      if (marker === 0xda && (!components || length !== 6 + 2 * data[0])) fail();
      if (kept === MAX_SEGMENTS) fail();
      starts[kept] = at;
      ends[kept] = end;
      if (marker === 0xda) {
        scans++;
        ends[kept] = entropyEnd(bytes, end);
      }
      at = ends[kept++];
      continue;
    }
    // Everything else (other APPn, comments, JPG extensions) is left behind.
    at = end;
  }
  if (!ended || !components || !scans) fail();

  const out = new Output(bytes.length);
  out.write([0xff, 0xd8]);
  if (jfif) out.write(jfifSegment(...jfif));
  if (orientation !== 1) out.write(orientationSegment(orientation));
  const count = icc[0]?.count ?? 0;
  const ordered = [...icc].sort((a, b) => a.seq - b.seq);
  const iccComplete = count > 0 && icc.length === count && ordered.every((chunk, n) => chunk.seq === n + 1 && chunk.count === count);
  if (iccComplete) {
    const profile = Buffer.concat(ordered.map((chunk) => bytes.subarray(chunk.start + 18, chunk.end)));
    if (validIcc(profile)) for (const chunk of ordered) out.write(bytes.subarray(chunk.start, chunk.end));
  }
  if (adobe >= 0 && components >= 3) out.write(adobeSegment(adobe));
  for (let n = 0; n < kept; n++) out.write(bytes.subarray(starts[n], ends[n]));
  out.write([0xff, 0xd9]);
  return { bytes: out.done(), orientation };
}

// ---------------------------------------------------------------------------- PNG

const PNG_SIGNATURE = "\x89PNG\r\n\x1a\n";
const PNG_KEPT = new Set(["IHDR", "PLTE", "tRNS", "IDAT", "IEND", "gAMA", "cHRM", "sRGB", "cICP", "sBIT"]);
const PNG_ANIMATION = new Set(["acTL", "fcTL", "fdAT"]);

function validIccp(data: Uint8Array): boolean {
  const nul = data.indexOf(0);
  if (nul < 1 || nul > 79 || data[nul + 1] !== 0) return false;
  try {
    return validIcc(inflateSync(data.subarray(nul + 2), { maxOutputLength: MAX_ICC_BYTES }));
  } catch {
    return false;
  }
}

export function stripPng(bytes: Uint8Array): Buffer {
  if (ascii(bytes, 0, 8) !== PNG_SIGNATURE) fail();
  const out = new Output(bytes.length);
  out.write(bytes.subarray(0, 8));
  let at = 8, chunks = 0, sawData = false, sawIccp = false;
  for (;;) {
    if (++chunks > MAX_PNG_CHUNKS || at + 12 > bytes.length) fail();
    const length = u32be(bytes, at);
    const end = at + 12 + length;
    if (end > bytes.length) fail();
    const type = ascii(bytes, at + 4, 4);
    if (!/^[A-Za-z]{4}$/.test(type)) fail();
    if ((chunks === 1) !== (type === "IHDR") || (type === "IHDR" && length !== 13)) fail();
    if (crc32(bytes.subarray(at + 4, at + 8 + length)) >>> 0 !== u32be(bytes, at + 8 + length)) fail();
    if (PNG_ANIMATION.has(type)) throw new AnimatedImageError();
    if (type === "IDAT") sawData = true;
    const keep = PNG_KEPT.has(type) || (type === "iCCP" && !sawIccp && !sawData && validIccp(bytes.subarray(at + 8, at + 8 + length)));
    if (type === "iCCP" && keep) sawIccp = true;
    if (keep) out.write(bytes.subarray(at, end));
    at = end;
    // Anything after the end chunk is not part of the image.
    if (type === "IEND") break;
  }
  if (!sawData) fail();
  return out.done();
}

// ---------------------------------------------------------------------------- WebP

const VP8X_ICC = 0x20;
const VP8X_ALPHA = 0x10;

/** The size a VP8 (lossy key frame) or VP8L (lossless) bitstream declares, and whether VP8L uses alpha. */
function bitstreamSize(type: string, data: Uint8Array): { width: number; height: number; alpha: boolean } | null {
  if (type === "VP8 ") {
    if (data.length < 10 || (data[0] & 1) !== 0 || data[3] !== 0x9d || data[4] !== 0x01 || data[5] !== 0x2a) return null;
    return { width: u16le(data, 6) & 0x3fff, height: u16le(data, 8) & 0x3fff, alpha: false };
  }
  if (data.length < 5 || data[0] !== 0x2f) return null;
  const bits = u32le(data, 1);
  if (bits >= 2 ** 29) return null; // version bits must be 0
  return { width: 1 + (bits & 0x3fff), height: 1 + (Math.floor(bits / 2 ** 14) & 0x3fff), alpha: (bits & 2 ** 28) !== 0 };
}
const u16le = (bytes: Uint8Array, at: number) => bytes[at] | (bytes[at + 1] << 8);

/** Writes one chunk with its pad byte. */
function writeChunk(out: Output, type: string, data: Uint8Array) {
  const header = Buffer.alloc(8);
  header.write(type, 0, "latin1");
  header.writeUInt32LE(data.length, 4);
  out.write(header);
  out.write(data);
  if (data.length % 2) out.write([0]);
}

export function stripWebp(bytes: Uint8Array): Buffer {
  if (ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") fail();
  const total = 8 + u32le(bytes, 4);
  if (total > bytes.length || total < 20) fail();
  let at = 12, chunks = 0;
  let canvas: { width: number; height: number } | null = null;
  let icc: Uint8Array | null = null, alpha: Uint8Array | null = null, image: { type: string; data: Uint8Array } | null = null;
  while (at < total) {
    if (++chunks > MAX_SEGMENTS || at + 8 > total) fail();
    const type = ascii(bytes, at, 4);
    const size = u32le(bytes, at + 4);
    if (at + 8 + size > total) fail();
    const data = bytes.subarray(at + 8, at + 8 + size);
    if (type === "ANIM" || type === "ANMF") throw new AnimatedImageError();
    if (chunks === 1 && type === "VP8X") {
      if (size < 10) fail();
      if (data[0] & 0x02) throw new AnimatedImageError();
      canvas = { width: 1 + u24le(data, 4), height: 1 + u24le(data, 7) };
    } else if (type === "VP8 " || type === "VP8L") {
      if (image) fail();
      image = { type, data };
    } else if (canvas && type === "ICCP" && !icc && !image) {
      icc = validIcc(data) ? data : null;
    } else if (canvas && type === "ALPH" && !alpha && !image) {
      alpha = data;
    }
    // EXIF, XMP, C2PA and any other chunk are left behind.
    at += 8 + size + (size % 2);
    // A simple (non-extended) file is its one bitstream chunk.
    if (!canvas && chunks === 1) break;
  }
  if (!image) fail();
  const size = bitstreamSize(image.type, image.data) ?? fail();
  if (size.width < 1 || size.height < 1) fail();
  if (canvas && (canvas.width !== size.width || canvas.height !== size.height)) fail();
  if (alpha && image.type !== "VP8 ") fail();

  const out = new Output(bytes.length + 32);
  out.write(Buffer.from("RIFF\0\0\0\0WEBP", "latin1"));
  if (canvas) {
    const header = Buffer.alloc(10);
    header[0] = (icc ? VP8X_ICC : 0) | (alpha || size.alpha ? VP8X_ALPHA : 0);
    header.writeUIntLE(size.width - 1, 4, 3);
    header.writeUIntLE(size.height - 1, 7, 3);
    writeChunk(out, "VP8X", header);
    if (icc) writeChunk(out, "ICCP", icc);
    if (alpha) writeChunk(out, "ALPH", alpha);
  }
  writeChunk(out, image.type, image.data);
  const result = out.done();
  result.writeUInt32LE(result.length - 8, 4);
  return result;
}

/** The image rebuilt without its metadata, and the orientation it should be shown in (1 = as stored). */
export function stripMetadata(type: MediaType, bytes: Uint8Array): { bytes: Buffer; orientation: number } {
  if (type === "image/jpeg") return stripJpeg(bytes);
  return { bytes: type === "image/png" ? stripPng(bytes) : stripWebp(bytes), orientation: 1 };
}
