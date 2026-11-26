import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The homepage demo videos must play in iPhone Safari. The first encodes carried an embedded ICC colour profile in the
 * avc1 sample entry ('colr' of type 'prof') and a variable frame timing on a microsecond timescale; iOS showed the
 * crossed-out play icon. These checks read the MP4 boxes so a re-encode cannot bring that back.
 */
type Box = { type: string; start: number; size: number; header: number };

function boxes(buf: Buffer, start: number, end: number): Box[] {
  const out: Box[] = [];
  for (let at = start; at + 8 <= end; ) {
    let size = buf.readUInt32BE(at);
    let header = 8;
    if (size === 1) { size = Number(buf.readBigUInt64BE(at + 8)); header = 16; }
    if (size < header) break;
    out.push({ type: buf.toString("latin1", at + 4, at + 8), start: at, size, header });
    at += size;
  }
  return out;
}

const child = (buf: Buffer, box: Box, type: string) => boxes(buf, box.start + box.header, box.start + box.size).find((b) => b.type === type);

function videoTrack(buf: Buffer) {
  const moov = boxes(buf, 0, buf.length).find((b) => b.type === "moov")!;
  for (const trak of boxes(buf, moov.start + 8, moov.start + moov.size).filter((b) => b.type === "trak")) {
    const mdia = child(buf, trak, "mdia")!;
    const hdlr = child(buf, mdia, "hdlr")!;
    if (buf.toString("latin1", hdlr.start + 16, hdlr.start + 20) !== "vide") continue;
    const mdhd = child(buf, mdia, "mdhd")!;
    const stbl = child(buf, child(buf, mdia, "minf")!, "stbl")!;
    const stsd = child(buf, stbl, "stsd")!;
    const stts = child(buf, stbl, "stts")!;
    // stsd: full box (4) + entry count (4), then the avc1 entry: 8-byte header + 78 bytes of visual fields.
    const avc1Start = stsd.start + 16;
    const avc1 = { type: buf.toString("latin1", avc1Start + 4, avc1Start + 8), start: avc1Start, size: buf.readUInt32BE(avc1Start), header: 8 + 78 };
    const version = buf[mdhd.start + 8];
    return {
      sampleEntry: avc1.type,
      extensions: boxes(buf, avc1.start + avc1.header, avc1.start + avc1.size),
      timescale: buf.readUInt32BE(mdhd.start + (version === 1 ? 28 : 20)),
      sttsEntries: buf.readUInt32BE(stts.start + 12),
      avc1,
    };
  }
  throw new Error("no video track");
}

describe.each(["en", "sv"])("homepage demo video (%s)", (locale) => {
  const buf = readFileSync(`public/site/phone-receptionist-${locale}.mp4`);
  const top = boxes(buf, 0, buf.length).map((b) => b.type);

  it("starts with ftyp and has moov before mdat, so it can start before the whole file is loaded", () => {
    expect(top[0]).toBe("ftyp");
    expect(top.indexOf("moov")).toBeGreaterThan(-1);
    expect(top.indexOf("moov")).toBeLessThan(top.indexOf("mdat"));
  });

  it("is H.264 High at level 4.0 or lower with no embedded ICC profile", () => {
    const v = videoTrack(buf);
    expect(v.sampleEntry).toBe("avc1");
    const avcC = v.extensions.find((b) => b.type === "avcC")!;
    expect(buf[avcC.start + 9]).toBe(100); // profile_idc: High
    expect(buf[avcC.start + 11]).toBeLessThanOrEqual(40); // level_idc
    for (const colr of v.extensions.filter((b) => b.type === "colr")) {
      expect(buf.toString("latin1", colr.start + 8, colr.start + 12)).toBe("nclx");
    }
  });

  it("has a constant frame rate on a plain timescale", () => {
    const v = videoTrack(buf);
    expect(v.timescale).toBeLessThanOrEqual(90000);
    expect(v.sttsEntries).toBeLessThanOrEqual(2);
  });
});
