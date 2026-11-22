import { describe, expect, it } from "vitest";
import { prepareImage } from "../src/lib/media/library";
import { sniffImage } from "../src/lib/media/sniff";
import { exifOrientation, stripJpeg, stripPng, stripWebp } from "../src/lib/media/strip";
import { exifSegment, GPS_MARK, jpegPicture, metadataPng, metadataWebp, phoneJpeg, pngParts, webpParts } from "./media-fixtures";

// Generated images only (tests/media-fixtures.ts); the GPS position is invented.

const has = (bytes: Uint8Array, value: string) => Buffer.from(bytes).includes(Buffer.from(value, "latin1"));

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

  it("refuses a truncated header and a picture too large to show", () => {
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toEqual({ ok: false, reason: "corrupt" });
    expect(sniffImage(phoneJpeg({ width: 12_000, height: 100 }))).toEqual({ ok: false, reason: "too_many_pixels" });
    expect(sniffImage(phoneJpeg({ width: 8000, height: 8000 }))).toEqual({ ok: false, reason: "too_many_pixels" });
  });
});

describe("metadata stripping", () => {
  it("removes EXIF with GPS, XMP, IPTC, comments and an appended image from a JPEG and keeps the picture byte for byte", () => {
    const original = phoneJpeg();
    expect(has(original, GPS_MARK)).toBe(true);
    const { bytes, orientation } = stripJpeg(original);
    expect(orientation).toBe(1);
    expect(has(bytes, GPS_MARK)).toBe(false);
    expect(has(bytes, "Exif")).toBe(false);
    expect(has(bytes, "http://ns.adobe.com/xap")).toBe(false);
    expect(has(bytes, "Photoshop")).toBe(false);
    expect(has(bytes, "MPF")).toBe(false);
    const picture = jpegPicture();
    expect(bytes).toEqual(Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      Buffer.from([0xff, 0xe0, 0, 16, ...Buffer.from("JFIF\0", "latin1"), 1, 1, 0, 0, 1, 0, 1, 0, 0]),
      Buffer.from([0xff, 0xe2, 0, 33, ...Buffer.from("ICC_PROFILE\0\x01\x01fictional-profile", "latin1")]),
      picture.dqt, picture.sof, picture.dht, picture.sos, picture.scan, picture.eoi,
    ]));
    expect(stripJpeg(bytes).bytes).toEqual(bytes);
  });

  it("keeps only the orientation of a rotated JPEG, after JFIF", () => {
    const { bytes, orientation } = stripJpeg(phoneJpeg({ orientation: 6 }));
    expect(orientation).toBe(6);
    expect(has(bytes, GPS_MARK)).toBe(false);
    const exif = bytes.indexOf(Buffer.from("Exif\0\0", "latin1"));
    expect(exif).toBeGreaterThan(bytes.indexOf(Buffer.from("JFIF", "latin1")));
    expect(exifOrientation(bytes.subarray(exif, exif + 32))).toBe(6);
    expect(bytes.readUInt16BE(exif - 2)).toBe(34);
    expect(exifOrientation(exifSegment(3).subarray(4))).toBe(3);
  });

  it("reports the shown size of a rotated photo", () => {
    const prepared = prepareImage(phoneJpeg({ orientation: 6, width: 640, height: 480 }));
    expect(prepared).toMatchObject({ ok: true, type: "image/jpeg", width: 480, height: 640 });
  });

  it("removes text, XMP, EXIF and time chunks from a PNG and keeps the other chunks as they were", () => {
    const original = metadataPng();
    expect(has(original, GPS_MARK)).toBe(true);
    const stripped = stripPng(original);
    expect(has(stripped, GPS_MARK)).toBe(false);
    const parts = pngParts();
    expect(stripped).toEqual(Buffer.concat([Buffer.from("\x89PNG\r\n\x1a\n", "latin1"), parts.ihdr, parts.iccp, parts.idat, parts.iend]));
  });

  it("removes EXIF and XMP from a WebP, clears their VP8X flags and fixes the RIFF size", () => {
    const original = metadataWebp();
    expect(has(original, GPS_MARK)).toBe(true);
    const stripped = stripWebp(original);
    expect(has(stripped, GPS_MARK)).toBe(false);
    expect(has(stripped, "EXIF")).toBe(false);
    const parts = webpParts();
    expect(stripped.readUInt32LE(4)).toBe(stripped.length - 8);
    expect(stripped[20]).toBe(0x20);
    expect(stripped.subarray(12 + parts.vp8x.length)).toEqual(Buffer.concat([parts.iccp, parts.vp8]));
    expect(sniffImage(stripped)).toEqual({ ok: true, type: "image/webp", width: 400, height: 300 });
  });

  it("refuses a file whose structure does not add up", () => {
    const jpeg = phoneJpeg();
    expect(prepareImage(jpeg.subarray(0, 30))).toEqual({ ok: false, reason: "corrupt" });
    const png = metadataPng();
    expect(prepareImage(png.subarray(0, 60))).toEqual({ ok: false, reason: "corrupt" });
    const webp = metadataWebp();
    webp.writeUInt32LE(0xfffff, 16);
    expect(prepareImage(webp)).toEqual({ ok: false, reason: "corrupt" });
  });

  it("hashes the stripped bytes, so two copies with different metadata are one picture", () => {
    const a = prepareImage(phoneJpeg());
    const b = prepareImage(Buffer.concat([phoneJpeg().subarray(0, 2), Buffer.from([0xff, 0xfe, 0, 6, 0x61, 0x62, 0x63, 0x64]), phoneJpeg().subarray(2)]));
    expect(a.ok && b.ok && a.sha256 === b.sha256).toBe(true);
  });
});
