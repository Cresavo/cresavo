import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { crc32, deflateSync } from "node:zlib";
import satori from "satori";
import { describe, expect, it } from "vitest";
import { contrast } from "@/concept/page/colour";
import { textWidth, type PosterFont } from "@/concept/campaigns/poster-engine/measure";
import { renderPosterSvg } from "@/concept/campaigns/poster-engine/render";
import { ENGINE_FORMATS, ENGINE_TEMPLATES, STORY_SAFE, posterDataSchema, type EngineFormat, type EngineTemplate } from "@/concept/campaigns/poster-engine/templates";

// The layout guard: every template, arrangement, format and text size is rendered with the worst content
// the schema allows, and the real SVG is measured. Satori draws text as filled paths with absolute
// coordinates, so each glyph outline's bounds are known, and each photo is an <image> with a clip box.
//
// Asserted for every render:
//  (a) every glyph, and every QR code, lies 64 px inside each edge of the poster;
//  (b) in a story no glyph lies in the top 270 px or the bottom 390 px, which Instagram covers;
//  (c) no text lies over the face zone of a photo: the top 45 % of an arch's or a cut-out's own box. Photos where
//      the text is kept off the whole box by design (Before/after, the mirrored Full photo) get the whole box;
//  (d) no two text runs overlap, so a block that grew into another shows up.
// What is NOT asserted: a full-bleed photo (the standard Full photo, the Free times band, the Price list strip) can
// have a face anywhere, and which part of it shows is the owner's own crop choice. Nothing can guarantee that.

const MARGIN = 64;
const FACE_SHARE = 0.45;
const SIZES = ["small", "normal", "large"] as const;
const ARRANGED = new Set<EngineTemplate>(["price", "portrait", "fullphoto", "beforeafter"]);

const jpeg = `data:image/jpeg;base64,${readFileSync("tests/fixtures/poster-photo.jpg").toString("base64")}`;

/** A 30 x 40 (3:4) transparent PNG, like a cut-out person. */
function cutoutPng() {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    return Buffer.concat([uint32(data.length), body, uint32(crc32(body))]);
  };
  const header = Buffer.concat([uint32(30), uint32(40), Buffer.from([8, 6, 0, 0, 0])]);
  const rows = Buffer.concat(Array.from({ length: 40 }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(30 * 4, 0x80)])));
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
  return `data:image/png;base64,${png.toString("base64")}`;
}
function uint32(value: number) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

const colors = { accent: "#c2557f", ink: "#1f1d22", background: "#f7f1e8" };
const signature = { salon: "Medicinsk fotvård och friskvårdsbehandlingar i Sundköping", phone: "070-123 45 67 123", link: `salongeko.example/${"a".repeat(62)}`, rating: 4.6, reviews: "48 omdömen" };
const qr = "https://salongeko.example/boka";

/** The longest content each slot accepts, and the short content with the reviewer's own failing words. */
const SCENARIOS = {
  longWithQr: { headline: "IDROTTSMASSAGEBEHANDLING", lead: "MOMMA KNOWS WOMEN CRAVE VOLUME", price: "SEK 1 800", detail: "Fotbad, nagelvård och fotmassage för trötta fötter efter en lång dag, med varm olja och en stunds lugn och ro.", badges: ["Epassi", "Benify", "Wellnessgåva", "Friskvårdsbidrag"], cta: "Boka din tid direkt hos oss nu →", pair: ["BEFOREBEFORE", "AFTERAFTERAF"], signature: { ...signature, qr } },
  longNoQr: { headline: "FRISKVÅRDSMASSAGE FÖR NACKE OCH AXLAR OK", lead: "MOMMA KNOWS WOMEN CRAVE VOLUME", price: "SEK 1 800", detail: "Idrottsmassagebehandlingar och friskvårdsmassage för nacke, axlar och rygg med varm olja i en lugn miljö hos oss i salon", badges: ["Epassi", "Benify", "Wellnessgåva", "Friskvårdsbidrag"], cta: "Boka nu →", signature },
  shortWords: { headline: "MAMMAMASSAGE", lead: "", price: "SEK 800", detail: "Fotbad och nagelvård.", badges: ["Epassi"], cta: "Boka nu →", signature: { ...signature, salon: "Salong Eko", link: "salongeko.cresavo.com", qr } },
  serifLong: { headline: "Idrottsmassagebehandlingar för alla nu", lead: "Momma knows women crave volume", price: "SEK 1 800", detail: "Fotbad, nagelvård och fotmassage för trötta fötter efter en lång dag, med varm olja och en stunds lugn och ro.", badges: ["Epassi", "Benify", "Wellnessgåva"], cta: "Boka nu →", serifHeadings: true, signature: { ...signature, qr } },
  /** Only what a poster needs: no sticker, badges, price, detail or button. */
  sparse: { headline: "Hej", lead: "", price: "", detail: "", badges: [], cta: "", label: "", sticker: undefined, items: [], quote: "Bra!", author: "", stars: undefined, signature: { ...signature, salon: "Eko", phone: "070", link: "eko.example" } },
} as const;

function posterData(scenario: keyof typeof SCENARIOS, size: (typeof SIZES)[number], arrangement: "standard" | "mirrored", extra: Record<string, unknown> = {}) {
  return posterDataSchema.parse({
    label: "Friskvård", sticker: ["Ny kund?", "–15%"], quote: "Jag har aldrig blivit så väl omhändertagen. Personalen lyssnade på precis allt jag behövde hjälp med, och resultatet höll i flera veckor efteråt. Tack för en fantastisk stund, jag kommer absolut tillbaka snart igen!", author: "Anna S. från Sundköping och långt därtill".slice(0, 40), stars: 5,
    items: Array.from({ length: 8 }, (_, i) => ({ name: `Behandling med ett långt namn nummer ${i + 1}`.slice(0, 40), price: "SEK 1 800" })),
    pair: ["BEFORE", "AFTER"], photo: jpeg, before: jpeg, colors, textSize: size, arrangement, ...SCENARIOS[scenario], ...extra,
  });
}

interface Box { x: number; y: number; width: number; height: number }
interface Photo extends Box { raster: boolean; qr: boolean }

const numbers = (value: string) => (value.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

const boxOf = (points: { x: number; y: number }[]): Box => {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
};

/** Every text run as the outlines of its glyphs (one M…Z contour each), transformed as Satori transformed the text. */
function textRuns(svg: string): { glyphs: Box[]; rotated: boolean }[] {
  return [...svg.matchAll(/<path fill="[^"]*"(?: transform="matrix\(([^)]*)\)")? d="([^"]*)"/g)].map(([, transform, d]) => {
    const [a, b, c, d2, e, f] = transform ? numbers(transform) : [1, 0, 0, 1, 0, 0];
    const glyphs = d.split(/(?=M)/).flatMap((contour) => {
      const values = numbers(contour);
      const points = Array.from({ length: Math.floor(values.length / 2) }, (_, i) => ({ x: a * values[i * 2] + c * values[i * 2 + 1] + e, y: b * values[i * 2] + d2 * values[i * 2 + 1] + f }));
      return points.length ? [boxOf(points)] : [];
    });
    return { glyphs, rotated: Boolean(transform) };
  });
}

/** Every embedded picture with the box it is visible in (its clip), and whether it is a photo or a QR code. */
function pictures(svg: string): Photo[] {
  const clips = new Map([...svg.matchAll(/<clipPath id="([^"]+)"[^>]*><(?:rect|path) x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/g)].map(([, id, x, y, width, height]) => [id, { x: +x, y: +y, width: +width, height: +height }]));
  return [...svg.matchAll(/<image [^>]*href="data:image\/([a-z+]+);base64,([^"]*)"[^>]*clip-path="url\(#([^)]+)\)"/g)].flatMap(([, kind, data, clip]) => {
    const box = clips.get(clip);
    const markup = kind === "svg+xml" ? Buffer.from(data, "base64").toString() : "";
    return box ? [{ ...box, raster: kind !== "svg+xml", qr: markup.includes('shape-rendering="crispEdges"') }] : [];
  });
}

const boxOfBoxes = (boxes: Box[]): Box => boxOf(boxes.flatMap((b) => [{ x: b.x, y: b.y }, { x: b.x + b.width, y: b.y + b.height }]));
/** A box pulled in by 2 px on every side, so touching letters and rounding do not count as overlap. */
const shrink = (box: Box): Box => ({ x: box.x + 2, y: box.y + 2, width: box.width - 4, height: box.height - 4 });
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/**
 * The share of each photo's own box, from its top, that no text may touch. Arches and cut-outs hold a face in
 * their top part. A before/after photo and a mirrored full photo are never under text. A full-bleed photo
 * (the standard full photo, a photo band or strip) cannot be guaranteed: which part shows is the owner's crop
 * choice, so nothing is asserted there.
 */
function protectedShare(template: EngineTemplate, arrangement: string): number {
  if (template === "beforeafter" || (template === "fullphoto" && arrangement === "mirrored")) return 1;
  if (template === "fullphoto" || template === "slots" || template === "pricelist") return 0;
  return FACE_SHARE;
}

function violations(svg: string, template: EngineTemplate, arrangement: string, format: EngineFormat): string[] {
  const { width, height } = ENGINE_FORMATS[format];
  const found: string[] = [];
  const runs = textRuns(svg);
  const glyphBoxes = runs.flatMap((run) => run.glyphs);
  const round = (box: Box) => `${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)}`;
  const outside = glyphBoxes.find((g) => g.x < MARGIN - 0.5 || g.y < MARGIN - 0.5 || g.x + g.width > width - MARGIN + 0.5 || g.y + g.height > height - MARGIN + 0.5);
  if (outside) found.push(`glyph outside the ${MARGIN}px margin at ${round(outside)}`);
  const codes = pictures(svg).filter((picture) => picture.qr);
  const badCode = codes.find((code) => code.x < MARGIN - 0.5 || code.y < MARGIN - 0.5 || code.x + code.width > width - MARGIN + 0.5 || code.y + code.height > height - MARGIN + 0.5);
  if (badCode) found.push(`QR code outside the margin at ${round(badCode)}`);
  if (format === "story") {
    const bars = glyphBoxes.find((g) => g.y < STORY_SAFE.top - 0.5 || g.y + g.height > height - STORY_SAFE.bottom + 0.5);
    if (bars) found.push(`glyph in a story bar at ${round(bars)}`);
  }
  // Two text runs never overlap: stacked blocks that grew into each other show up as crossing outlines (a rotated sticker's lines are skipped: their boxes are tilted).
  const blocks = runs.filter((run) => run.glyphs.length && !run.rotated).map((run) => boxOfBoxes(run.glyphs));
  const crossing = blocks.flatMap((a, i) => blocks.slice(i + 1).filter((b) => overlaps(shrink(a), shrink(b))).map((b) => `${round(a)} and ${round(b)}`));
  if (crossing.length) found.push(`text runs overlap: ${crossing[0]}`);
  if (!glyphBoxes.length) found.push("no text was drawn");
  const share = protectedShare(template, arrangement);
  if (share) {
    for (const photo of pictures(svg).filter((picture) => picture.raster)) {
      const zone = { ...photo, height: photo.height * share };
      const hit = glyphBoxes.find((g) => overlaps(g, zone));
      if (hit) found.push(`text at ${round(hit)} over the photo at ${round(photo)} (protected: top ${Math.round(share * 100)} %)`);
    }
  }
  return found;
}

const cases = ENGINE_TEMPLATES.flatMap((template) => (ARRANGED.has(template) ? (["standard", "mirrored"] as const) : (["standard"] as const)).flatMap((arrangement) =>
  (Object.keys(ENGINE_FORMATS) as EngineFormat[]).map((format) => ({ template, arrangement, format }))));

describe("poster layout guard", () => {
  describe.each(cases)("$template $arrangement $format", ({ template, arrangement, format }) => {
    it("keeps text inside the margins, the story bars and clear of faces, at every size and with the longest content", async () => {
      const found: string[] = [];
      const withCutout = template === "portrait" ? [{ photo: cutoutPng(), cutout: true }] : [];
      for (const size of SIZES) {
        for (const scenario of Object.keys(SCENARIOS) as (keyof typeof SCENARIOS)[]) {
          for (const extra of [{}, ...withCutout]) {
            const svg = await renderPosterSvg(template, posterData(scenario, size, arrangement, extra), format);
            found.push(...violations(svg, template, arrangement, format).map((message) => `${size} ${scenario}${"cutout" in extra ? " cutout" : ""}: ${message}`));
          }
        }
      }
      expect(found).toEqual([]);
    }, 60_000);
  });

  describe("contrast", () => {
    const pale = { ...colors, ink: "#f0e8df" };
    it.each(["price", "beforeafter"] as const)("never sets %s text in an ink that does not read on the background", async (template) => {
      expect(contrast(pale.ink, pale.background)).toBeLessThan(1.1);
      const svg = await renderPosterSvg(template, posterData("shortWords", "normal", "standard", { colors: pale }), "post");
      expect(svg).not.toMatch(new RegExp(`<path fill="${pale.ink}"(?: transform="[^"]*")? d=`));
      const fills = [...svg.matchAll(/<path fill="(#[0-9a-f]{6})" d=/g)].map(([, fill]) => fill);
      expect(fills.some((fill) => contrast(fill, pale.background) >= 4.5)).toBe(true);
    });
  });

  describe("text measuring", () => {
    // The width tables in measure.ts must match what Satori lays out with the bundled fonts.
    const FONTS: { font: PosterFont; name: string; weight: 600 | 800 | 900 | 400; file: string }[] = [
      { font: "semibold", name: "Inter", weight: 600, file: "Inter-SemiBold.otf" },
      { font: "extrabold", name: "Inter", weight: 800, file: "Inter-ExtraBold.otf" },
      { font: "black", name: "Inter Display", weight: 900, file: "InterDisplay-Black.otf" },
      { font: "serif", name: "Caladea", weight: 400, file: "Caladea-Regular.ttf" },
    ];
    const SAMPLES = ["Idrottsmassagebehandling", "MAMMAMASSAGE", "Friskvårdsmassage för nacke SEK 1 800", "Åsa Öberg · salongeko.example/boka →"];

    it.each(FONTS)("never measures $font narrower than Satori lays it out, nor more than 3 % wider", async ({ font, name, weight, file }) => {
      const data = await readFile(`src/concept/campaigns/poster-engine/fonts/${file}`);
      for (const [size, spacing] of [[100, 0], [60, -2]]) {
        for (const sample of SAMPLES) {
          const tree = { type: "div", props: { style: { display: "flex", width: 4000, height: 300, alignItems: "flex-start" }, children: { type: "div", props: { style: { display: "flex", fontFamily: name, fontWeight: weight, fontSize: size, letterSpacing: spacing, whiteSpace: "nowrap" }, children: sample } } } };
          const svg = await satori(tree as Parameters<typeof satori>[0], { width: 4000, height: 300, fonts: [{ name, data, weight, style: "normal" }] });
          const laidOut = Number([...svg.matchAll(/<mask id="[^"]*"><rect x="0" y="0" width="([\d.]+)" height="(?!300)/g)][0][1]);
          const measured = textWidth(sample, font, size, spacing);
          expect(measured, `${sample} at ${size}`).toBeGreaterThanOrEqual(laidOut - 1);
          expect(measured, `${sample} at ${size}`).toBeLessThanOrEqual(laidOut * 1.03);
        }
      }
    });
  });
});
