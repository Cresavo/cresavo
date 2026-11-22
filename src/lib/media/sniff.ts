// What an uploaded file really is, from its own bytes: the declared type is never trusted. Only JPEG, PNG and
// WebP are accepted; HEIC is named so the owner can be told what to do, and everything else (SVG, GIF, PDF,
// HTML) is refused. Width and height come from the format's own header, without decoding the picture.

export type MediaType = "image/jpeg" | "image/png" | "image/webp";

/** A side longer than this, or more pixels than MAX_PIXELS, is refused: a browser would struggle to show it. */
export const MAX_SIDE = 10_000;
export const MAX_PIXELS = 40_000_000;

export type Sniffed =
  | { ok: true; type: MediaType; width: number; height: number }
  | { ok: false; reason: "heic" | "unsupported" | "corrupt" | "too_many_pixels" };

const ascii = (bytes: Uint8Array, start: number, length: number) =>
  start + length <= bytes.length ? String.fromCharCode(...bytes.subarray(start, start + length)) : "";
const u16be = (bytes: Uint8Array, at: number) => (bytes[at] << 8) | bytes[at + 1];
const u32be = (bytes: Uint8Array, at: number) => ((bytes[at] << 24) >>> 0) + (bytes[at + 1] << 16) + (bytes[at + 2] << 8) + bytes[at + 3];
const u24le = (bytes: Uint8Array, at: number) => bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16);

const HEIF_BRANDS = new Set(["heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1", "avif"]);

/** JPEG start-of-frame markers: C0–CF except DHT (C4), JPG (C8) and DAC (CC). */
const isStartOfFrame = (marker: number) => marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  let at = 2;
  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1];
    if (marker === 0xff) { at++; continue; }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { at += 2; continue; }
    if (marker === 0xd9 || marker === 0xda) return null;
    const length = u16be(bytes, at + 2);
    if (length < 2 || at + 2 + length > bytes.length) return null;
    if (isStartOfFrame(marker)) return length >= 7 ? { height: u16be(bytes, at + 5), width: u16be(bytes, at + 7) } : null;
    at += 2 + length;
  }
  return null;
}

function webpSize(bytes: Uint8Array): { width: number; height: number } | null {
  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8X" && bytes.length >= 30) return { width: 1 + u24le(bytes, 24), height: 1 + u24le(bytes, 27) };
  if (chunk === "VP8 " && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return { width: (bytes[26] | (bytes[27] << 8)) & 0x3fff, height: (bytes[28] | (bytes[29] << 8)) & 0x3fff };
  }
  if (chunk === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
  }
  return null;
}

function typeOf(bytes: Uint8Array): MediaType | "heic" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (ascii(bytes, 0, 8) === "\x89PNG\r\n\x1a\n") return "image/png";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "image/webp";
  if (ascii(bytes, 4, 4) === "ftyp" && HEIF_BRANDS.has(ascii(bytes, 8, 4))) return "heic";
  return null;
}

/** The file's real type and its stored width and height, or why it is refused. */
export function sniffImage(bytes: Uint8Array): Sniffed {
  const type = typeOf(bytes);
  if (type === "heic") return { ok: false, reason: "heic" };
  if (!type) return { ok: false, reason: "unsupported" };
  const size = type === "image/jpeg" ? jpegSize(bytes)
    : type === "image/png" ? (ascii(bytes, 12, 4) === "IHDR" && bytes.length >= 24 ? { width: u32be(bytes, 16), height: u32be(bytes, 20) } : null)
    : webpSize(bytes);
  if (!size || size.width <= 0 || size.height <= 0) return { ok: false, reason: "corrupt" };
  if (size.width > MAX_SIDE || size.height > MAX_SIDE || size.width * size.height > MAX_PIXELS) return { ok: false, reason: "too_many_pixels" };
  return { ok: true, type, ...size };
}
