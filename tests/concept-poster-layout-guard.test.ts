import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { crc32, deflateSync } from "node:zlib";
import satori from "satori";
import { describe, expect, it } from "vitest";
import { contrast } from "@/concept/page/colour";
import { normalSpaces, textWidth, wrapText, type PosterFont } from "@/concept/campaigns/poster-engine/measure";
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
const BASE = {
  longWithQr: { headline: "IDROTTSMASSAGEBEHANDLING", lead: "MOMMA KNOWS WOMEN CRAVE VOLUME", price: "SEK 1 800", detail: "Fotbad, nagelvård och fotmassage för trötta fötter efter en lång dag, med varm olja och en stunds lugn och ro.", badges: ["Epassi", "Benify", "Wellnessgåva", "Friskvårdsbidrag"], cta: "Boka din tid direkt hos oss nu →", pair: ["BEFOREBEFORE", "AFTERAFTERAF"], signature: { ...signature, qr } },
  longNoQr: { headline: "FRISKVÅRDSMASSAGE FÖR NACKE OCH AXLAR OK", lead: "MOMMA KNOWS WOMEN CRAVE VOLUME", price: "SEK 1 800", detail: "Idrottsmassagebehandlingar och friskvårdsmassage för nacke, axlar och rygg med varm olja i en lugn miljö hos oss i salon", badges: ["Epassi", "Benify", "Wellnessgåva", "Friskvårdsbidrag"], cta: "Boka nu →", signature },
  shortWords: { headline: "MAMMAMASSAGE", lead: "", price: "SEK 800", detail: "Fotbad och nagelvård.", badges: ["Epassi"], cta: "Boka nu →", signature: { ...signature, salon: "Salong Eko", link: "salongeko.cresavo.com", qr } },
  serifLong: { headline: "Idrottsmassagebehandlingar för alla nu", lead: "Momma knows women crave volume", price: "SEK 1 800", detail: "Fotbad, nagelvård och fotmassage för trötta fötter efter en lång dag, med varm olja och en stunds lugn och ro.", badges: ["Epassi", "Benify", "Wellnessgåva"], cta: "Boka nu →", serifHeadings: true, signature: { ...signature, qr } },
  /** Only what a poster needs: no sticker, badges, price, detail or button. */
  sparse: { headline: "Hej", lead: "", price: "", detail: "", badges: [], cta: "", label: "", sticker: undefined, items: [], quote: "Bra!", author: "", stars: undefined, signature: { ...signature, salon: "Eko", phone: "070", link: "eko.example" } },
} as const;

/** The reviewers' reproductions: non-breaking spaces, a long multiword price, a short price, accented capitals. */
const SCENARIOS = {
  ...BASE,
  nbsp: { ...BASE.longWithQr, headline: "NY\u00a0KUND\u00a0HOS\u00a0OSS", detail: "Fotbad\u202fför\u00a0trötta\u00a0fötter" },
  multiPrice: { ...BASE.longWithQr, headline: "Fotvård", price: "2 499,00 SEK/par" },
  shortPrice: { ...BASE.longWithQr, price: "9 kr" },
  accents: { ...BASE.shortWords, headline: "Årskort", lead: "Ändå Östra", detail: "Åsa Ödmjuk", signature: { ...signature, salon: "Åsa Öberg", link: "salongeko.cresavo.com", qr } },
} as const;

function posterData(scenario: keyof typeof SCENARIOS, size: (typeof SIZES)[number], arrangement: "standard" | "mirrored", extra: Record<string, unknown> = {}) {
  return posterDataSchema.parse({
    label: "Friskvård", sticker: ["Sista chansen!", "BOKA NU!"], quote: "Jag har aldrig blivit så väl omhändertagen. Personalen lyssnade på precis allt jag behövde hjälp med, och resultatet höll i flera veckor efteråt. Tack för en fantastisk stund, jag kommer absolut tillbaka snart igen!", author: "Anna S. från Sundköping och långt därtill".slice(0, 40), stars: 5,
    items: Array.from({ length: 8 }, (_, i) => ({ name: `Behandling med ett långt namn nummer ${i + 1}`.slice(0, 40), price: "SEK 1 800" })),
    pair: ["BEFORE", "AFTER"], photo: jpeg, before: jpeg, colors, textSize: size, arrangement, ...SCENARIOS[scenario], ...extra,
  });
}

interface Box { x: number; y: number; width: number; height: number }
interface Photo extends Box { raster: boolean; qr: boolean }
interface TextRun { glyphs: Box[]; rotated: boolean }

const numbers = (value: string) => (value.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

/** The attributes of one SVG tag, whatever their order (Satori puts `fill-opacity` or `transform` between `fill` and `d`). */
const attributes = (tag: string): Record<string, string> => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value]));

type Point = { x: number; y: number };

/** The point mapper of a `transform` attribute: Satori only writes `matrix(a b c d e f)`; anything else fails the test, it is never skipped. */
function transformOf(value: string | undefined): (x: number, y: number) => Point {
  if (!value) return (x, y) => ({ x, y });
  const matrix = /^matrix\(([^)]*)\)$/.exec(value.trim());
  if (!matrix) throw new Error(`Cannot resolve the transform "${value}"`);
  const [a, b, c, d, e, f] = numbers(matrix[1]);
  return (x, y) => ({ x: a * x + c * y + e, y: b * x + d * y + f });
}

const boxOf = (points: Point[]): Box => {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
};

/** Every text run as the outlines of its glyphs (one M…Z contour each), transformed as Satori transformed the text. Shapes carry x, y, width and height; glyph paths do not. */
function textRuns(svg: string): TextRun[] {
  return [...svg.matchAll(/<path ([^>]*?)\/?>/g)].flatMap(([, raw]) => {
    const path = attributes(raw);
    if (path.d === undefined || path.fill === undefined || path.fill === "none" || path.x !== undefined) return [];
    const map = transformOf(path.transform);
    const glyphs = path.d.split(/(?=M)/).flatMap((contour) => {
      const values = numbers(contour);
      const points = Array.from({ length: Math.floor(values.length / 2) }, (_, i) => map(values[i * 2], values[i * 2 + 1]));
      return points.length ? [boxOf(points)] : [];
    });
    return [{ glyphs, rotated: Boolean(path.transform) }];
  });
}

const glyphCount = (svg: string) => textRuns(svg).reduce((sum, run) => sum + run.glyphs.length, 0);

/**
 * Every embedded picture with the box it is visible in, in poster coordinates, and whether it is a photo or a QR code.
 * The box is the picture's clip (a rect or path), moved by the transform on the picture and on the clip itself. A picture
 * inside a transformed group, or whose clip cannot be found, fails the test: nothing is skipped.
 */
function pictures(svg: string): Photo[] {
  if (/<g [^>]*transform=[^>]*>(?:(?!<\/g>)[^])*<image/.test(svg)) throw new Error("An image sits inside a transformed group");
  const clips = new Map([...svg.matchAll(/<clipPath ([^>]*)>(<(?:rect|path) [^>]*>)/g)].map(([, outer, shape]) => [attributes(outer).id, attributes(shape)]));
  return [...svg.matchAll(/<image ([^>]*?)\/?>/g)].flatMap(([, raw]) => {
    const image = attributes(raw);
    const kind = /^data:image\/([a-z+]+);base64,/.exec(image.href ?? "")?.[1];
    if (!kind) throw new Error("An image without an embedded data URL");
    const clipId = /url\(#([^)]+)\)/.exec(image["clip-path"] ?? "")?.[1];
    const clip = clipId ? clips.get(clipId) : undefined;
    if (!clip || clip.x === undefined || clip.width === undefined) throw new Error(`The clip of an image (${clipId}) cannot be resolved`);
    const own = transformOf(image.transform);
    const clipMap = transformOf(clip.transform);
    const [x, y, width, height] = [clip.x, clip.y, clip.width, clip.height].map(Number);
    const box = boxOf([[x, y], [x + width, y], [x, y + height], [x + width, y + height]].map(([px, py]) => { const inner = clipMap(px, py); return own(inner.x, inner.y); }));
    const markup = kind === "svg+xml" ? Buffer.from(image.href.split(",")[1], "base64").toString() : "";
    return [{ ...box, raster: kind !== "svg+xml", qr: markup.includes('shape-rendering="crispEdges"') }];
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

/** How many photos a template draws with these inputs (the before/after poster has two; the type-only poster none). */
const photoCount = (template: EngineTemplate) => (template === "typography" ? 0 : template === "beforeafter" ? 2 : 1);

function violations(svg: string, template: EngineTemplate, arrangement: string, format: EngineFormat): string[] {
  const { width, height } = ENGINE_FORMATS[format];
  const found: string[] = [];
  const runs = textRuns(svg);
  const glyphBoxes = runs.flatMap((run) => run.glyphs);
  const round = (box: Box) => `${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)}`;
  const outside = (box: Box) => box.x < MARGIN - 0.5 || box.y < MARGIN - 0.5 || box.x + box.width > width - MARGIN + 0.5 || box.y + box.height > height - MARGIN + 0.5;
  const inBar = (box: Box) => box.y < STORY_SAFE.top - 0.5 || box.y + box.height > height - STORY_SAFE.bottom + 0.5;
  const pics = pictures(svg);
  const rasters = pics.filter((picture) => picture.raster);
  const codes = pics.filter((picture) => picture.qr);
  if (rasters.length !== photoCount(template)) found.push(`${rasters.length} photos resolved, ${photoCount(template)} expected`);
  const badGlyph = glyphBoxes.find(outside);
  if (badGlyph) found.push(`glyph outside the ${MARGIN}px margin at ${round(badGlyph)}`);
  const badCode = codes.find(outside);
  if (badCode) found.push(`QR code outside the margin at ${round(badCode)}`);
  if (format === "story") {
    const bars = glyphBoxes.find(inBar) ?? codes.find(inBar);
    if (bars) found.push(`text or QR code in a story bar at ${round(bars)}`);
  }
  // Two text runs never overlap: stacked blocks that grew into each other show up as crossing outlines. A sticker's
  // tilted lines count as one block (its footprint), so it is held apart from every other text.
  const blocks = [...runs.filter((run) => run.glyphs.length && !run.rotated).map((run) => boxOfBoxes(run.glyphs)), ...(runs.some((run) => run.rotated) ? [boxOfBoxes(runs.filter((run) => run.rotated).flatMap((run) => run.glyphs))] : [])];
  const crossing = blocks.flatMap((a, i) => blocks.slice(i + 1).filter((b) => overlaps(shrink(a), shrink(b))).map((b) => `${round(a)} and ${round(b)}`));
  if (crossing.length) found.push(`text runs overlap: ${crossing[0]}`);
  if (!glyphBoxes.length) found.push("no text was drawn");
  const share = protectedShare(template, arrangement);
  if (share) {
    for (const photo of rasters) {
      const zone = { ...photo, height: photo.height * share };
      const hit = glyphBoxes.find((g) => overlaps(g, zone)) ?? codes.find((code) => overlaps(code, zone));
      if (hit) found.push(`text or QR code at ${round(hit)} over the photo at ${round(photo)} (protected: top ${Math.round(share * 100)} %)`);
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
    const SAMPLES = ["Idrottsmassagebehandling", "MAMMAMASSAGE", "Friskvårdsmassage för nacke SEK 1 800", "Åsa Öberg · salongeko.example/boka →", "ŒŒŒŒ", "œŠŽšž", "WWWW", "AVAV", "Å"];

    it.each(FONTS)("measures $font within 2 % under and 3 % over what Satori lays out", async ({ font, name, weight, file }) => {
      const data = await readFile(`src/concept/campaigns/poster-engine/fonts/${file}`);
      for (const [size, spacing] of [[100, 0], [60, -2]]) {
        for (const sample of SAMPLES) {
          const tree = { type: "div", props: { style: { display: "flex", width: 4000, height: 300, alignItems: "flex-start" }, children: { type: "div", props: { style: { display: "flex", fontFamily: name, fontWeight: weight, fontSize: size, letterSpacing: spacing, whiteSpace: "nowrap" }, children: sample } } } };
          const svg = await satori(tree as Parameters<typeof satori>[0], { width: 4000, height: 300, fonts: [{ name, data, weight, style: "normal" }] });
          const laidOut = Number([...svg.matchAll(/<mask id="[^"]*"><rect x="0" y="0" width="([\d.]+)" height="(?!300)/g)][0][1]);
          const measured = textWidth(sample, font, size, spacing);
          // Never narrower than 2 % under what is drawn (the fits keep 5 % spare); kerned pairs such as AV draw up to 25 % narrower.
          expect(measured, `${sample} at ${size}`).toBeGreaterThanOrEqual(laidOut * 0.98);
          expect(measured, `${sample} at ${size}`).toBeLessThanOrEqual(laidOut * (sample === "AVAV" ? 1.3 : 1.03));
        }
      }
    });
  });

  describe("stickers", () => {
    it.each(["price", "slots"] as const)("keeps both lines of the longest sticker inside its circle on the %s poster", async (template) => {
      const svg = await renderPosterSvg(template, posterData("longWithQr", "large", "standard"), "post");
      const circle = [...svg.matchAll(/<path ([^>]*?)\/?>/g)].map(([, raw]) => attributes(raw)).find((path) => path.transform && path.x !== undefined && path.width === path.height && path.fill !== "none")!;
      const { x, y, width } = { x: Number(circle.x), y: Number(circle.y), width: Number(circle.width) };
      const centre = transformOf(circle.transform)(x + width / 2, y + width / 2);
      const corners = textRuns(svg).filter((run) => run.rotated).flatMap((run) => run.glyphs).flatMap((g) => [[g.x, g.y], [g.x + g.width, g.y], [g.x, g.y + g.height], [g.x + g.width, g.y + g.height]]);
      expect(corners.length).toBeGreaterThan(0);
      expect(Math.max(...corners.map(([cx, cy]) => Math.hypot(cx - centre.x, cy - centre.y)))).toBeLessThanOrEqual(width / 2);
    });
  });

  describe("every text slot is measured", () => {
    // Each slot, emptied, must remove glyphs from the render: a parser that skips a path would leave it unmeasured.
    const empty = (slot: string): Record<string, unknown> => ({
      headline: { headline: "" }, lead: { lead: "" }, price: { price: "" }, detail: { detail: "" }, cta: { cta: "" }, badges: { badges: [] }, label: { label: "" }, items: { items: [] },
      sticker: { sticker: undefined }, quote: { quote: "", headline: "" }, author: { author: "" }, pair: { pair: ["", ""] }, fullPhotoLine: { price: "", detail: "" },
      salon: { signature: { ...slotSignature, salon: "" } }, phone: { signature: { ...slotSignature, phone: "" } }, link: { signature: { ...slotSignature, link: "" } }, rating: { signature: { ...slotSignature, rating: undefined, reviews: undefined } },
    }[slot]!);
    const slotSignature = { ...signature, link: "eko.example/boka", qr };
    const signatureSlots = ["salon", "phone", "link", "rating"];
    const SLOTS: Record<EngineTemplate, { post: string[]; story?: string[] }> = {
      price: { post: ["headline", "price", "detail", "sticker", "badges", ...signatureSlots] },
      pricelist: { post: ["label", "headline", "items", "badges", ...signatureSlots.slice(0, 3)] },
      season: { post: ["headline", "detail", "cta", ...signatureSlots] },
      review: { post: ["quote", "author", ...signatureSlots] },
      slots: { post: ["headline", "sticker", "items", "detail", ...signatureSlots], story: ["cta"] },
      beforeafter: { post: ["headline", "pair", "detail", ...signatureSlots], story: ["cta"] },
      portrait: { post: ["lead", "headline", "badges", "detail", "cta", "salon", "phone", "link"] },
      fullphoto: { post: ["salon", "headline", "fullPhotoLine", "cta", "phone", "link"] },
      typography: { post: ["headline", "detail", "cta", "salon", "link"] },
    };
    const cases = Object.entries(SLOTS).flatMap(([template, { post, story = [] }]) => [...post.map((slot) => [template, "post", slot] as const), ...story.map((slot) => [template, "story", slot] as const)]);
    it.each(cases)("%s %s: the %s slot adds measured glyphs", async (template, format, slot) => {
      const full = posterData("longWithQr", "normal", "standard", { signature: slotSignature, stars: 5 });
      const patched = posterDataSchema.parse({ ...full, ...empty(slot) });
      const [withSlot, without] = await Promise.all([renderPosterSvg(template as EngineTemplate, full, format as EngineFormat), renderPosterSvg(template as EngineTemplate, patched, format as EngineFormat)]);
      // A skipped path leaves the counts equal. (A button or contact line that falls back to another text can gain glyphs when a slot is emptied.)
      expect(glyphCount(withSlot)).not.toBe(glyphCount(without));
    });

    const layout = async (style: object, value: string, width: number) => {
      const data = await readFile("src/concept/campaigns/poster-engine/fonts/Inter-SemiBold.otf");
      const tree = { type: "div", props: { style: { display: "flex", width, height: 1000, alignItems: "flex-start" }, children: { type: "div", props: { style: { display: "flex", fontFamily: "Inter", fontWeight: 600, ...style }, children: value } } } };
      const svg = await satori(tree as Parameters<typeof satori>[0], { width, height: 1000, fonts: [{ name: "Inter", data, weight: 600, style: "normal" }] });
      return Number([...svg.matchAll(/<mask id="[^"]*"><rect x="0" y="0" width="[\d.]+" height="(?!1000)([\d.]+)"/g)][0][1]);
    };

    it("never measures a decomposed accent narrower than it is drawn", async () => {
      const value = "A\u030aSA\u030a";
      expect(textWidth(value, "extrabold", 100)).toBeGreaterThanOrEqual(await layout({ fontSize: 100, fontWeight: 800, whiteSpace: "nowrap" }, value, 4000).then(() => textWidth("ASA", "extrabold", 100) - 1));
    });

    it("breaks lines after hyphens as Satori does", async () => {
      for (const [value, room] of [["Vår-och-höstkampanj-för-alla", 300], ["Idrotts-massage-behandling nu", 330], ["Fot--vård och-nagel", 200]] as const) {
        const rows = (await layout({ fontSize: 40, lineHeight: 1 }, value, room)) / 40;
        expect(wrapText(value, "semibold", 40, room), value).toHaveLength(rows);
      }
    });

    it("turns no-break and narrow spaces into ordinary ones", () => {
      expect(normalSpaces("NY\u00a0KUND\u202fHOS\u2009OSS")).toBe("NY KUND HOS OSS");
      expect(posterDataSchema.parse({ ...posterData("shortWords", "normal", "standard"), headline: "NY\u00a0KUND" }).headline).toBe("NY KUND");
    });

    it("keeps a single over-wide badge inside the text column", async () => {
      const svg = await renderPosterSvg("price", posterData("shortWords", "normal", "standard", { badges: ["W".repeat(20)] }), "post");
      expect(Math.max(...textRuns(svg).flatMap((run) => run.glyphs).filter((g) => g.y > 1000 && g.y < 1130).map((g) => g.x + g.width))).toBeLessThanOrEqual(1080 - 64);
    });
  });
});
