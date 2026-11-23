import { describe, expect, it } from "vitest";
import { prepareImage } from "../src/lib/media/library";
import { sniffImage } from "../src/lib/media/sniff";
import { AnimatedImageError, CorruptImageError, exifOrientation, MAX_PNG_CHUNKS, MAX_SEGMENTS, stripJpeg, stripPng, stripWebp } from "../src/lib/media/strip";
import {
  adobeSegment, c2paSegment, exifSegment, GPS_MARK, iccSegments, jfifWithThumbnail, jpegPicture, metadataPng, metadataWebp, phoneJpeg, PNG_SIGNATURE,
  pngChunk, pngParts, riff, segment, vp8x, webpChunk, webpParts,
} from "./media-fixtures";

// Generated images only (tests/media-fixtures.ts); the GPS position is invented.

const has = (bytes: Uint8Array, value: string) => Buffer.from(bytes).includes(Buffer.from(value, "latin1"));
const SOI = Buffer.from([0xff, 0xd8]);
const minimalJfif = Buffer.from([0xff, 0xe0, 0, 16, ...Buffer.from("JFIF\0", "latin1"), 1, 2, 1, 0, 72, 0, 72, 0, 0]);
const minimalAdobe = (transform: number) => Buffer.from([0xff, 0xee, 0, 14, ...Buffer.from("Adobe", "latin1"), 0, 100, 0, 0, 0, 0, transform]);
const jpeg = (...parts: Buffer[]) => Buffer.concat([SOI, ...parts]);

describe("sniffImage", () => {
  it("reads the real type and size from the bytes", () => {
    expect(sniffImage(phoneJpeg({ width: 640, height: 480 }))).toEqual({ ok: true, type: "image/jpeg", width: 640, height: 480 });
    expect(sniffImage(metadataPng())).toEqual({ ok: true, type: "image/png", width: 320, height: 200 });
    expect(sniffImage(metadataWebp())).toEqual({ ok: true, type: "image/webp", width: 400, height: 300 });
  });

  it("names HEIC and refuses what is not a JPEG, PNG or WebP", () => {
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypheic\0\0\0\0mif1heic", "latin1")]);
    expect(sniffImage(heic)).toEqual({ ok: false, reason: "heic" });
    for (const other of ["<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>", "GIF89a\x01\x00\x01\x00", "%PDF-1.7", "<!doctype html><p>"]) {
      expect(sniffImage(Buffer.from(other, "latin1")), other).toEqual({ ok: false, reason: "unsupported" });
    }
    expect(sniffImage(Buffer.alloc(0))).toEqual({ ok: false, reason: "unsupported" });
  });

  it("refuses a truncated header and more than 40 megapixels", () => {
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toEqual({ ok: false, reason: "corrupt" });
    expect(sniffImage(phoneJpeg({ width: 12_000, height: 100 }))).toEqual({ ok: false, reason: "too_many_pixels" });
    expect(sniffImage(phoneJpeg({ width: 8000, height: 8000 }))).toEqual({ ok: false, reason: "too_many_pixels" });
    expect(sniffImage(phoneJpeg({ width: 8000, height: 5000 }))).toMatchObject({ ok: true });
  });
});

describe("JPEG rebuild", () => {
  it("keeps only the picture, a thumbnail-free JFIF header, the ICC profile and Adobe's transform byte", () => {
    const original = phoneJpeg();
    expect(has(original, GPS_MARK)).toBe(true);
    const { bytes, orientation } = stripJpeg(original);
    expect(orientation).toBe(1);
    const picture = jpegPicture();
    expect(bytes).toEqual(jpeg(minimalJfif, ...iccSegments(), minimalAdobe(1), picture.dqt, picture.sof, picture.dht, picture.sos, picture.scan, picture.eoi));
    for (const gone of [GPS_MARK, "Exif", "http://ns.adobe.com/xap", "Photoshop", "MPF", "c2pa", "jumb", "Comment"]) expect(has(bytes, gone), gone).toBe(false);
    expect(stripJpeg(bytes).bytes).toEqual(bytes);
  });

  it("drops the JFIF thumbnail, a C2PA manifest and Adobe APP14 for a one-component picture", () => {
    const gray = jpegPicture(64, 64, 1);
    const { bytes } = stripJpeg(jpeg(jfifWithThumbnail(), adobeSegment(0), c2paSegment(), gray.dqt, gray.sof, gray.dht, gray.sos, gray.scan, gray.eoi));
    expect(bytes).toEqual(jpeg(minimalJfif, gray.dqt, gray.sof, gray.dht, gray.sos, gray.scan, gray.eoi));
    // No JFIF in the original: none is added (it would change how an Adobe file's colours are read).
    const cmyk = jpegPicture(64, 64, 4);
    expect(stripJpeg(jpeg(adobeSegment(2), cmyk.dqt, cmyk.sof, cmyk.dht, cmyk.sos, cmyk.scan, cmyk.eoi)).bytes)
      .toEqual(jpeg(minimalAdobe(2), cmyk.dqt, cmyk.sof, cmyk.dht, cmyk.sos, cmyk.scan, cmyk.eoi));
  });

  it("drops an ICC profile that is incomplete or not a profile", () => {
    const picture = jpegPicture();
    const body = [picture.dqt, picture.sof, picture.dht, picture.sos, picture.scan, picture.eoi];
    const [first] = iccSegments();
    expect(stripJpeg(jpeg(first, ...body)).bytes).toEqual(jpeg(...body));
    expect(stripJpeg(jpeg(segment(0xe2, [...Buffer.from("ICC_PROFILE\0", "latin1"), 1, 1, ...Buffer.from(GPS_MARK)]), ...body)).bytes).toEqual(jpeg(...body));
  });

  it("keeps only the orientation of a rotated photo, after JFIF", () => {
    const { bytes, orientation } = stripJpeg(phoneJpeg({ orientation: 6 }));
    expect(orientation).toBe(6);
    expect(has(bytes, GPS_MARK)).toBe(false);
    const exif = bytes.indexOf(Buffer.from("Exif\0\0", "latin1"));
    expect(exif).toBe(2 + minimalJfif.length + 4);
    expect(exifOrientation(bytes.subarray(exif, exif + 32))).toBe(6);
    expect(bytes.readUInt16BE(exif - 2)).toBe(34);
    expect(exifOrientation(exifSegment(3).subarray(4))).toBe(3);
    expect(prepareImage(phoneJpeg({ orientation: 6, width: 640, height: 480 }))).toMatchObject({ ok: true, width: 480, height: 640 });
  });

  it("requires a frame, a scan and the end marker", () => {
    const p = jpegPicture();
    for (const parts of [[p.dqt, p.sof, p.dht, p.sos, p.scan], [p.dqt, p.sof, p.dht, p.eoi], [p.dqt, p.dht, p.sos, p.scan, p.eoi], [p.dqt, p.sof, p.sof, p.sos, p.scan, p.eoi]]) {
      expect(() => stripJpeg(jpeg(...parts))).toThrow(CorruptImageError);
    }
  });

  it("refuses more segments than the cap, without building them up first", () => {
    const p = jpegPicture();
    const comments = Array.from({ length: MAX_SEGMENTS }, () => segment(0xfe, [0x61]));
    expect(() => stripJpeg(jpeg(...comments, p.dqt, p.sof, p.dht, p.sos, p.scan, p.eoi))).toThrow(CorruptImageError);
    const fewer = comments.slice(0, MAX_SEGMENTS - 10);
    expect(stripJpeg(jpeg(...fewer, p.dqt, p.sof, p.dht, p.sos, p.scan, p.eoi)).bytes.length).toBeLessThan(200);
  });
});

describe("PNG rebuild", () => {
  it("keeps the decoding and colour chunks and drops text, XMP, EXIF, time, C2PA and the rest", () => {
    const stripped = stripPng(metadataPng());
    const parts = pngParts();
    expect(stripped).toEqual(Buffer.concat([PNG_SIGNATURE, parts.ihdr, parts.iccp, parts.idat, parts.iend]));
    for (const gone of [GPS_MARK, "caBX", "pHYs", "tEXt"]) expect(has(stripped, gone), gone).toBe(false);
  });

  it("drops an iCCP chunk that is not a compressed profile", () => {
    const parts = pngParts();
    const bad = pngChunk("iCCP", Buffer.from(`name\0\0${GPS_MARK}`, "latin1"));
    expect(stripPng(Buffer.concat([PNG_SIGNATURE, parts.ihdr, bad, parts.idat, parts.iend]))).toEqual(Buffer.concat([PNG_SIGNATURE, parts.ihdr, parts.idat, parts.iend]));
  });

  it("requires IHDR first, image data, the end chunk and correct checksums", () => {
    const parts = pngParts();
    const broken = Buffer.from(parts.idat);
    broken[broken.length - 1] ^= 1;
    for (const file of [
      Buffer.concat([PNG_SIGNATURE, parts.ihdr, parts.iend]),
      Buffer.concat([PNG_SIGNATURE, parts.ihdr, parts.idat]),
      Buffer.concat([PNG_SIGNATURE, parts.idat, parts.ihdr, parts.iend]),
      Buffer.concat([PNG_SIGNATURE, parts.ihdr, broken, parts.iend]),
    ]) expect(() => stripPng(file)).toThrow(CorruptImageError);
  });

  it("refuses an animated PNG and more chunks than the cap", () => {
    const parts = pngParts();
    expect(() => stripPng(Buffer.concat([PNG_SIGNATURE, parts.ihdr, pngChunk("acTL", Buffer.alloc(8)), parts.idat, parts.iend]))).toThrow(AnimatedImageError);
    expect(prepareImage(Buffer.concat([PNG_SIGNATURE, parts.ihdr, pngChunk("acTL", Buffer.alloc(8)), parts.idat, parts.iend]))).toEqual({ ok: false, reason: "animated" });
    const many = Array.from({ length: MAX_PNG_CHUNKS }, () => pngChunk("tEXt", Buffer.from("a\0b")));
    expect(() => stripPng(Buffer.concat([PNG_SIGNATURE, parts.ihdr, ...many, parts.idat, parts.iend]))).toThrow(CorruptImageError);
  });
});

describe("WebP rebuild", () => {
  it("keeps the bitstream and the ICC profile, drops EXIF, XMP and C2PA, and rebuilds VP8X", () => {
    const stripped = stripWebp(metadataWebp());
    const parts = webpParts();
    expect(stripped).toEqual(riff(vp8x(400, 300, 0x20), parts.iccp, parts.vp8));
    for (const gone of [GPS_MARK, "EXIF", "XMP ", "C2PA"]) expect(has(stripped, gone), gone).toBe(false);
    expect(sniffImage(stripped)).toEqual({ ok: true, type: "image/webp", width: 400, height: 300 });
  });

  it("keeps a simple WebP as its one bitstream chunk", () => {
    const parts = webpParts();
    expect(stripWebp(riff(parts.vp8, webpChunk("EXIF", Buffer.from(GPS_MARK))))).toEqual(riff(parts.vp8));
  });

  it("refuses a VP8X size that disagrees with the bitstream, a missing bitstream and animation", () => {
    const parts = webpParts();
    expect(() => stripWebp(riff(vp8x(4000, 3000), parts.vp8))).toThrow(CorruptImageError);
    expect(() => stripWebp(riff(vp8x(400, 300), parts.iccp))).toThrow(CorruptImageError);
    expect(() => stripWebp(riff(vp8x(400, 300, 0x02), webpChunk("ANIM", Buffer.alloc(6)), webpChunk("ANMF", Buffer.alloc(16))))).toThrow(AnimatedImageError);
    expect(() => stripWebp(riff(vp8x(400, 300, 0), webpChunk("ANMF", Buffer.alloc(16)), parts.vp8))).toThrow(AnimatedImageError);
    const truncated = metadataWebp();
    truncated.writeUInt32LE(0xfffff, 16);
    expect(prepareImage(truncated)).toEqual({ ok: false, reason: "corrupt" });
  });
});

it("hashes the rebuilt bytes, so two copies with different metadata are one picture", () => {
  const a = prepareImage(phoneJpeg());
  const b = prepareImage(Buffer.concat([SOI, segment(0xfe, [0x61, 0x62]), phoneJpeg().subarray(2)]));
  expect(a.ok && b.ok && a.sha256 === b.sha256).toBe(true);
});
