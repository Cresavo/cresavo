import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { qrFor, qrLink, qrTarget, shortLink } from "@/concept/campaigns/poster-engine/client";
import { renderPosterSvg } from "@/concept/campaigns/poster-engine/render";
import { cutoutPlacement, pngSize, posterDataSchema, posterTree } from "@/concept/campaigns/poster-engine/templates";
import { backdropSvg, BACKDROPS } from "@/concept/campaigns/poster-engine/backdrops";
import { hasTransparency } from "@/concept/campaigns/poster-engine/client";

// The server poster engine: input limits, the template slots and a real render. Fictional salon.

const jpeg = `data:image/jpeg;base64,${readFileSync("tests/fixtures/poster-photo.jpg").toString("base64")}`;
const input = {
  headline: "Salongens fotvård", price: "750 kr", detail: "Fotbad, nagelvård och fotmassage.", sticker: ["Ny kund?", "–15%"],
  label: "Friskvård", items: [{ name: "Fotvård", price: "895 kr" }, { name: "Spamassage", price: "790 kr" }], badges: ["Epassi"],
  photo: jpeg, colors: { accent: "#c2557f", ink: "#1f1d22", background: "#ffffff" },
  signature: { salon: "Salong Eko", phone: "070-123 45 67", link: "salongeko.cresavo.com", rating: 4.6, reviews: "48 omdömen" },
};
const flat = (node: unknown): string => JSON.stringify(node);

describe("poster engine input", () => {
  it("accepts a complete poster and fills defaults", () => {
    const data = posterDataSchema.parse(input);
    expect(data).toMatchObject({ focus: "center", textSize: "normal", serifHeadings: false });
  });

  it("refuses WebP or remote photos, bad colours, long text and unknown fields", () => {
    expect(posterDataSchema.safeParse({ ...input, photo: "data:image/webp;base64,AAAA" }).success).toBe(false);
    expect(posterDataSchema.safeParse({ ...input, photo: "https://elsewhere.example/a.jpg" }).success).toBe(false);
    expect(posterDataSchema.safeParse({ ...input, colors: { ...input.colors, accent: "red" } }).success).toBe(false);
    expect(posterDataSchema.safeParse({ ...input, headline: "x".repeat(41) }).success).toBe(false);
    expect(posterDataSchema.safeParse({ ...input, script: "<script>" }).success).toBe(false);
    expect(posterDataSchema.safeParse({ ...input, items: Array.from({ length: 9 }, () => ({ name: "a", price: "1" })) }).success).toBe(false);
  });

  it("accepts only an https address for the QR code", () => {
    expect(posterDataSchema.safeParse({ ...input, signature: { ...input.signature, qr: "https://salongeko.example/c/x" } }).success).toBe(true);
    for (const qr of ["http://salongeko.example", "javascript:alert(1)", "https://a.example/\"><script>", `https://${"a".repeat(200)}.example`]) {
      expect(posterDataSchema.safeParse({ ...input, signature: { ...input.signature, qr } }).success).toBe(false);
    }
    expect(posterDataSchema.safeParse({ ...input, signature: { ...input.signature, qr: "https://?campaign=x" } }).success).toBe(false);
    expect(qrLink("https://eko.example/c/x")).toBe("https://eko.example/c/x");
    for (const link of ["salongeko.example/c/x", "http://eko.example", "https://?campaign=x", undefined]) expect(qrLink(link)).toBeUndefined();
    // A demo tracking link is not a real address, so the QR code leads to the salon's booking page on this site.
    expect(qrTarget("salongeko.example/c/x", "salong-eko", "https://demo.cresavo.com")).toBe("https://demo.cresavo.com/boka/salong-eko");
    expect(qrTarget("https://eko.example/c/x", "salong-eko", "https://demo.cresavo.com")).toBe("https://eko.example/c/x");
    expect(qrTarget("salongeko.example/c/x", "salong-eko", "http://localhost:3000")).toBeUndefined();
    // Posts and stories carry the code only when the owner asks; the printed window poster always does.
    expect(qrFor("post", false, "https://eko.example/c/x", "salong-eko", undefined)).toBeUndefined();
    expect(qrFor("story", true, "https://eko.example/c/x", "salong-eko", undefined)).toBe("https://eko.example/c/x");
    expect(qrFor("window", false, "https://eko.example/c/x", "salong-eko", undefined)).toBe("https://eko.example/c/x");
  });

  it("shortens long booking links for the signature", () => {
    expect(shortLink("https://salongeko.example/c/10-off-medical-7w4")).toBe("salongeko.example/c/10-off-medi…");
    expect(shortLink("https://eko.example")).toBe("eko.example");
  });
});

describe("poster engine templates", () => {
  const data = posterDataSchema.parse(input);

  it("puts the price, sticker and signature on the price poster", () => {
    const tree = flat(posterTree("price", data, "post"));
    for (const part of ["Salongens fotvård", "750 kr", "Ny kund?", "070-123 45 67", "Salong Eko", "48 omdömen"]) expect(tree).toContain(part);
    expect(flat(posterTree("price", { ...data, sticker: undefined }, "post"))).not.toContain("Ny kund?");
  });

  it("lists every treatment and badge on the price list", () => {
    const tree = flat(posterTree("pricelist", data, "post"));
    for (const part of ["FRISKVÅRD", "Fotvård", "895 kr", "Spamassage", "Epassi"]) expect(tree).toContain(part);
  });

  it("draws a QR code in the signature only when there is a booking address", () => {
    const withQr = posterDataSchema.parse({ ...input, signature: { ...input.signature, qr: "https://salongeko.example/c/x" } });
    const qrImages = (tree: string) => (tree.match(/data:image\/svg\+xml;base64,[^"]+/g) ?? [])
      .map((uri) => Buffer.from(uri.split(",")[1], "base64").toString()).filter((svg) => svg.includes("crispEdges"));
    expect(qrImages(flat(posterTree("price", withQr, "post")))).toHaveLength(1);
    expect(qrImages(flat(posterTree("price", data, "post")))).toHaveLength(0);
  });

  it("keeps a QR code beside the booking button on the free-times story", () => {
    const withQr = posterDataSchema.parse({ ...input, cta: "Boka nu →", signature: { ...input.signature, qr: "https://salongeko.example/c/x" } });
    const tree = flat(posterTree("slots", withQr, "story"));
    expect(tree).toContain("Boka nu →");
    expect(tree).toContain("data:image/svg+xml;base64,");
    expect(tree.match(/data:image\/svg\+xml;base64,[^"]+/g)!.some((uri) => Buffer.from(uri.split(",")[1], "base64").toString().includes("crispEdges"))).toBe(true);
  });

  it("shows the wellness badges on the price poster", () => {
    expect(flat(posterTree("price", data, "post"))).toContain("Epassi");
    expect(flat(posterTree("price", { ...data, badges: [] }, "post"))).not.toContain("Epassi");
  });

  it("puts the before and after photos with their labels on the before/after poster", () => {
    const before = jpeg.replace("data:image/jpeg", "data:image/png");
    const paired = posterDataSchema.parse({ ...input, before, pair: ["Före", "Efter"], cta: "Boka nu →" });
    for (const format of ["post", "story"] as const) {
      const tree = flat(posterTree("beforeafter", paired, format));
      for (const part of ["FÖRE", "EFTER", "Salongens fotvård", before.slice(0, 40), jpeg.slice(0, 40)]) expect(tree).toContain(part);
    }
    expect(flat(posterTree("beforeafter", paired, "story"))).toContain("Boka nu →");
    expect(posterDataSchema.safeParse({ ...input, before: "https://elsewhere.example/a.jpg" }).success).toBe(false);
  });

  it("lays out the portrait poster with its lead line, badges and the link inside the story's safe zone", () => {
    const portrait = posterDataSchema.parse({ ...input, lead: "Betala med", headline: "friskvårdsbidrag", cta: "Boka nu →", backdrop: "leaves" });
    const tree = flat(posterTree("portrait", portrait, "post"));
    for (const part of ["Betala med", "friskvårdsbidrag", "Epassi", "Salong Eko", "salongeko.cresavo.com"]) expect(tree).toContain(part);
    // In a story the link sits above the 390 px Instagram keeps for its own bar.
    expect(flat(posterTree("portrait", portrait, "story"))).toContain('"bottom":430');
    expect(posterDataSchema.safeParse({ ...input, backdrop: "anything" }).success).toBe(false);
  });

  it("keeps every story's text out of the bars Instagram lays over the top 270 px and bottom 390 px", () => {
    // Templates without their own story layout show the post as a card exactly between the bars.
    for (const template of ["price", "pricelist", "season", "review"] as const) {
      expect(flat(posterTree(template, data, "story"))).toContain('"top":270,"width":1008,"height":1260');
    }
    // Templates with their own story layout move their signature or button above the bottom bar.
    expect(flat(posterTree("slots", { ...data, cta: "Boka nu →" }, "story"))).toContain('"bottom":390');
    expect(flat(posterTree("beforeafter", { ...data, before: jpeg }, "story"))).toContain('"bottom":390');
  });

  it("draws every backdrop as one valid SVG in the salon's colour", () => {
    for (const kind of BACKDROPS) {
      const svg = backdropSvg(kind, 1080, 1350, "#c2557f");
      expect(svg.startsWith("<svg")).toBe(true);
      // An attribute twice on one element makes the whole SVG invalid.
      for (const element of svg.match(/<[a-z]+ [^>]*>/g) ?? []) {
        const names = [...element.matchAll(/ ([a-z-]+)="/g)].map((match) => match[1]);
        expect(new Set(names).size).toBe(names.length);
      }
    }
  });

  it("keeps a cut-out person's face above the text block, or the text in the left column", () => {
    // Room enough: the person grows until the head (top 45 %) ends above the text.
    const roomy = cutoutPlacement({ width: 3, height: 4 }, 1080, 1920, 1500);
    expect(roomy.clear).toBe(true);
    expect(roomy.top + roomy.height * 0.45).toBeLessThanOrEqual(1500);
    // Not enough room: the person stays smaller, right of the text column.
    const tight = cutoutPlacement({ width: 3, height: 4 }, 1080, 1350, 500);
    expect(tight.clear).toBe(false);
    expect(tight.left).toBeGreaterThanOrEqual(Math.round(1080 * 0.4));
    expect(tight.width).toBeLessThanOrEqual(Math.ceil(1080 * 0.66));
  });

  it("reads a PNG's size and tells transparent photos from opaque ones", () => {
    const png = "data:image/png;base64," + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 3, 0x20, 0, 0, 4, 0x2c, 8, 6, 0, 0, 0]).toString("base64");
    expect(pngSize(png)).toEqual({ width: 800, height: 1068 });
    expect(pngSize(jpeg)).toBeNull();
    expect(hasTransparency(new Uint8ClampedArray([1, 2, 3, 255, 1, 2, 3, 255]), 1)).toBe(false);
    expect(hasTransparency(new Uint8ClampedArray([1, 2, 3, 255, 1, 2, 3, 0]), 1)).toBe(true);
  });

  it("follows the salon's colours and the photo crop", () => {
    expect(flat(posterTree("pricelist", data, "post"))).toContain("#c2557f");
    expect(flat(posterTree("price", { ...data, focus: "top" }, "story"))).toContain("50% 10%");
  });

  it("renders an SVG with the text as shapes and the photo embedded", async () => {
    const svg = await renderPosterSvg("price", data, "post");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('width="1080"');
    expect(svg).toContain("data:image/jpeg;base64,");
    expect(svg).not.toMatch(/<script|<foreignObject/);
  }, 20_000);
});

describe("season, review and free-times templates", () => {
  const data = posterDataSchema.parse({ ...input, cta: "Boka nu →", quote: "Bästa timmen på hela månaden.", author: "Sofia L.", items: [{ name: "10:00", price: "" }, { name: "13:30", price: "" }] });

  it("puts the greeting and call to book on the season poster", () => {
    const tree = flat(posterTree("season", { ...data, headline: "God jul" }, "post"));
    for (const part of ["God jul", "Boka nu →", "070-123 45 67"]) expect(tree).toContain(part);
  });

  it("shows the customer's words and name on the review poster", () => {
    const tree = flat(posterTree("review", data, "story"));
    for (const part of ["Bästa timmen på hela månaden.", "Sofia L.", "“"]) expect(tree).toContain(part);
  });

  it("lists the free times with the day, and a booking button on a story", () => {
    const story = flat(posterTree("slots", { ...data, headline: "2 tider kvar!", sticker: ["Fre", "12 dec"] }, "story"));
    for (const part of ["2 tider kvar!", "10:00  ·  13:30", "Fre", "Boka nu →"]) expect(story).toContain(part);
    expect(flat(posterTree("slots", data, "post"))).toContain("070-123 45 67");
  });
});
