import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrast } from "@/concept/page/colour";
import { engineRequest, qrFor, qrLink, qrTarget, shortLink } from "@/concept/campaigns/poster-engine/client";
import { renderPosterSvg } from "@/concept/campaigns/poster-engine/render";
import type { PosterNode } from "@/concept/campaigns/poster-engine/element";
import { cutoutPlacement, ENGINE_FORMATS, fitHeadline, pngSize, posterDataSchema, posterTree, STORY_SAFE } from "@/concept/campaigns/poster-engine/templates";
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

describe("full photo and type-only templates", () => {
  const data = posterDataSchema.parse({ ...input, price: "", cta: "Boka nu →", headline: "Fotvård" });

  it("puts the headline, detail, call to book, salon and contact line on the full photo poster, in post and story", () => {
    for (const format of ["post", "story"] as const) {
      const tree = flat(posterTree("fullphoto", data, format));
      for (const part of ["Fotvård", "Fotbad, nagelvård och fotmassage.", "Boka nu →", "Salong Eko", "070-123 45 67", "salongeko.cresavo.com", "data:image/jpeg"]) expect(tree).toContain(part);
    }
    // A price replaces the detail line.
    expect(flat(posterTree("fullphoto", { ...data, price: "750 kr" }, "post"))).toContain("750 kr");
  });

  it("keeps the full photo story's text out of the bars Instagram lays over the top and bottom", () => {
    const tree = flat(posterTree("fullphoto", data, "story"));
    expect(tree).toContain('"top":290');
    expect(tree).toContain('"bottom":430');
    expect(tree).not.toContain('"top":270,"width":1008');
  });

  it("puts the words, rule, call to book, salon and link on the type-only poster, without drawing the photo", () => {
    const tree = flat(posterTree("typography", data, "post"));
    for (const part of ["Fotvård", "Fotbad, nagelvård och fotmassage.", "Boka nu →", "Salong Eko", "salongeko.cresavo.com", "#c2557f"]) expect(tree).toContain(part);
    expect(tree).not.toContain("data:image/jpeg");
    // In a story it is the post layout as a card between the bars.
    expect(flat(posterTree("typography", data, "story"))).toContain('"top":270,"width":1008,"height":1260');
  });

  it("sizes a headline by its length, not below the floor unless its longest word needs it, and gives a longer text more lines", () => {
    const room = 952;
    expect(fitHeadline("Fotvård", room, 150, 72, 2)).toEqual({ size: 150, lines: 1 });
    expect(fitHeadline("Friskvårdsmassage för nacke och axlar", room, 150, 72, 2).lines).toBe(2);
    expect(fitHeadline("Vårens fotvård", room, 230, 96, 3).lines).toBe(2);
    for (const headline of ["a", "Ansiktsbehandling", "Friskvårdsmassage för nacke och axlar"]) {
      expect(fitHeadline(headline, room, 150, 72, 2).size).toBeGreaterThanOrEqual(72);
      expect(fitHeadline(headline, room, 230, 96, 3).size).toBeGreaterThanOrEqual(Math.min(96, Math.floor(room / (headline.length * 0.6))));
    }
  });

  it("renders both templates as SVG", async () => {
    for (const template of ["fullphoto", "typography"] as const) expect((await renderPosterSvg(template, data, "story")).startsWith("<svg")).toBe(true);
  }, 20_000);
});

describe("full photo and type-only templates under stress", () => {
  const room = (width: number) => width - 128;
  const longWord = "Idrottsmassagebehandling";
  const base = posterDataSchema.parse({ ...input, price: "", cta: "Boka nu →", headline: longWord, textSize: "large" });
  const qrData = { ...base, signature: { ...base.signature, qr: "https://salongeko.example/boka" } };

  /** The right-most x of any glyph outline: Satori draws text as filled paths of absolute M/L/Q/C/Z commands. */
  const rightEdge = (svg: string) => Math.max(...[...svg.matchAll(/<path fill="[^"]*" d="([^"]*)"/g)].flatMap(([, d]) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).filter((_, i) => i % 2 === 0).map(Number)));
  const find = (node: PosterNode | string, wanted: string): PosterNode | undefined => {
    if (typeof node === "string") return undefined;
    const children = [node.props.children ?? []].flat();
    return children.includes(wanted) ? node : children.map((child) => find(child, wanted)).find(Boolean);
  };

  it("keeps the longest word inside the margins at Large text, in every format", async () => {
    for (const template of ["fullphoto", "typography"] as const) {
      for (const format of ["post", "story", "window"] as const) {
        const { width } = ENGINE_FORMATS[format];
        expect(rightEdge(await renderPosterSvg(template, base, format)), `${template} ${format}`).toBeLessThanOrEqual(width - 64);
      }
    }
  }, 30_000);

  it("keeps a long name and an 80-character link on the poster, with the QR code", async () => {
    const link = `salongeko.example/${"a".repeat(62)}`;
    const long = { ...qrData, headline: "Fotvård", signature: { ...qrData.signature, salon: "Medicinsk fotvård och friskvårdsbehandlingar i Sundköping", link } };
    for (const template of ["fullphoto", "typography"] as const) {
      expect(rightEdge(await renderPosterSvg(template, long, "post")), template).toBeLessThanOrEqual(1080);
    }
  }, 30_000);

  it("never sets the price poster's headline in the background's colour", () => {
    const grey = { ...base, headline: "Fotvård", colors: { accent: "#c2557f", ink: "#888888", background: "#888888" } };
    expect(flat(posterTree("price", grey, "post"))).not.toMatch(/"color":"#888888"[^}]*\}[^]*?Fotvård/);
  });

  it("lets the size go below the floor when the longest word would not fit, and not otherwise", () => {
    const fit = fitHeadline(longWord, room(1080), Math.round(150 * 1.15), Math.round(72 * 1.15), 2);
    expect(fit.size).toBeLessThan(Math.round(72 * 1.15));
    expect(fit.size * longWord.length * 0.6).toBeLessThanOrEqual(room(1080));
    expect(fitHeadline("Fotvård", room(1080), 150, 72, 2).size).toBe(150);
    expect(fitHeadline("x".repeat(40), room(1080), 150, 72, 2).size * 40 * 0.6).toBeLessThanOrEqual(room(1080));
  });

  it("starts the full photo scrim's strong stop above the headline, also when a QR code makes the contact row taller", () => {
    const stop = (data: typeof base) => Number(flat(posterTree("fullphoto", data, "post")).match(/rgba\(0,0,0,0\.8\) (\d+)%/)![1]) * 13.5;
    // The headline's top: the block's bottom edge (64) minus the contact row, call to book, detail and headline lines.
    const size = fitHeadline(longWord, 952, Math.round(150 * 1.15), Math.round(72 * 1.15), 2).size;
    const headlineTop = (contactRow: number) => 1350 - 64 - 32 - contactRow - (36 + 88) - (24 + Math.round(44 * 1.15) * 1.25) - Math.round(size * 0.98);
    // The stop is rounded to whole percent (13.5 px).
    expect(stop(base)).toBeLessThanOrEqual(headlineTop(40) + 7);
    expect(stop(qrData)).toBeLessThanOrEqual(headlineTop(120) + 7);
    expect(stop(qrData)).toBeLessThan(stop(base) - 60);
  });

  it("reads the type-only text and call to book by their real contrast, not a cut-off", () => {
    // White on this gold is 2.35:1; and an ink so close to the background that it would vanish.
    const tree = posterTree("typography", { ...base, colors: { accent: "#c9a45c", ink: "#f0e8df", background: "#f7f1e8" }, cta: "Boka nu →" }, "post");
    const label = find(tree, "Boka nu →")!.props.style!.color as string;
    expect(contrast(label, "#c9a45c")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tree.props.style!.color as string, "#f7f1e8")).toBeGreaterThanOrEqual(4.5);
    // A good ink is kept, and a dark background gets a light text.
    expect(posterTree("typography", { ...base, colors: { accent: "#c9a45c", ink: "#1f1d22", background: "#f7f1e8" } }, "post").props.style!.color).toBe("#1f1d22");
    const dark = posterTree("typography", { ...base, colors: { accent: "#2f5d50", ink: "#1f1d22", background: "#14110f" } }, "post");
    expect(contrast(dark.props.style!.color as string, "#14110f")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(find(dark, "Boka nu →")!.props.style!.color as string, "#2f5d50")).toBeGreaterThanOrEqual(4.5);
  });

  it("gives the type-only salon name its own budget: the name gives way long before the booking link", () => {
    const name = "Salong Eko Hudvård och Kroppsbehandlingar för alla";
    const tree = posterTree("typography", { ...base, headline: "Fotvård", signature: { ...base.signature, salon: name, link: "salongeko.cresavo.com/boka" } }, "post");
    const part = (value: string) => find(tree, value)!.props.style!;
    expect(part(name)).toMatchObject({ overflow: "hidden", textOverflow: "ellipsis" });
    expect(part(name).flexShrink).toBeGreaterThanOrEqual(100 * Number(part("salongeko.cresavo.com/boka").flexShrink));
    expect(part("salongeko.cresavo.com/boka")).toMatchObject({ whiteSpace: "nowrap" });
  });

  it("draws the type-only poster without a photo, and refuses another template without one", async () => {
    const withoutPhoto = { ...base, photo: undefined };
    expect(posterDataSchema.safeParse(withoutPhoto).success).toBe(true);
    expect(await renderPosterSvg("typography", withoutPhoto, "post")).toMatch(/^<svg/);
    expect(() => posterTree("fullphoto", withoutPhoto, "post")).toThrow("needs a photo");
  }, 20_000);

  it("fetches and sends no photo for the type-only poster", async () => {
    const poster = { style: "typography" as const, image: "/demo/salon.webp", headline: "Fotvård", detail: "Fotbad." };
    const { data } = await engineRequest(poster, "post", "Friskvård", { salon: { name: "Salong Eko", phone: "070-123 45 67", slug: "salong-eko" }, link: "salongeko.example" });
    expect(data).not.toHaveProperty("photo");
    expect(data.cutout).toBe(false);
  });
});

describe("mirrored arrangement", () => {
  const nodes = (tree: PosterNode): PosterNode[] => {
    const children = tree.props.children === undefined ? [] : [tree.props.children].flat();
    return [tree, ...children.flatMap((child) => (typeof child === "string" ? [] : nodes(child)))];
  };
  const find = (tree: PosterNode, match: (node: PosterNode) => boolean) => nodes(tree).find(match)!.props.style!;
  const textStyle = (tree: PosterNode, value: string) => find(tree, (node) => node.props.children === value);
  const imageStyle = (tree: PosterNode, source: string) => find(tree, (node) => node.props.src === source);
  const svgs = (tree: PosterNode) => nodes(tree).filter((node) => node.props.src?.startsWith("data:image/svg+xml")).map((node) => Buffer.from(node.props.src!.split(",")[1], "base64").toString());
  const standard = posterDataSchema.parse({ ...input, cta: "Boka nu →", headline: "Fotvård" });
  const mirrored = { ...standard, arrangement: "mirrored" as const };

  it("defaults to the standard arrangement and refuses unknown ones", () => {
    expect(standard.arrangement).toBe("standard");
    expect(posterDataSchema.safeParse({ ...input, arrangement: "upside-down" }).success).toBe(false);
  });

  it("moves the price poster's photo to the left and its text, price and sticker to the right", () => {
    const [before, after] = [posterTree("price", standard, "post"), posterTree("price", mirrored, "post")];
    expect(imageStyle(before, standard.photo!)).toHaveProperty("right");
    const photo = imageStyle(after, standard.photo!);
    expect(photo).toMatchObject({ left: -40 });
    expect(photo).not.toHaveProperty("right");
    const photoEdge = Number(photo.left) + Number(photo.width);
    for (const part of ["Fotvård", "Fotbad, nagelvård och fotmassage."]) {
      const { left, width } = textStyle(after, part);
      expect(Number(left)).toBeGreaterThanOrEqual(photoEdge);
      expect(Number(left) + Number(width)).toBeLessThanOrEqual(1080 - 64);
    }
    expect(textStyle(after, "750 kr")).toMatchObject({ right: 76 });
    const sticker = find(after, (node) => node.props.style?.transform === "rotate(-12deg)");
    expect(Number(sticker.left)).toBeGreaterThan(photoEdge - 80);
    // The wave is drawn the other way round; the signature strip stays where it was.
    expect(svgs(after).some((svg) => svg.includes("scale(-1 1)"))).toBe(true);
    expect(svgs(before).some((svg) => svg.includes("scale(-1 1)"))).toBe(false);
    expect(find(after, (node) => node.props.style?.bottom === 56)).toMatchObject({ left: 64, width: 952 });
    // A long word shrinks to the column instead of running off the poster's right edge.
    const long = posterTree("price", { ...mirrored, headline: "Friskvårdsmassage" }, "post");
    expect(Number(textStyle(long, "Friskvårdsmassage").fontSize) * 17 * 0.6).toBeLessThanOrEqual(1080 - 64 - Number(textStyle(long, "Friskvårdsmassage").left));
  });

  it("puts the portrait text column on the right and mirrors its scrim, footer and arch", () => {
    const portrait = posterDataSchema.parse({ ...input, lead: "Betala med", headline: "friskvårdsbidrag", cta: "Boka nu →", signature: { ...input.signature, qr: "https://salongeko.example/c/x" } });
    const flipped = { ...portrait, arrangement: "mirrored" as const };
    const [before, after] = [posterTree("portrait", portrait, "post"), posterTree("portrait", flipped, "post")];
    expect(flat(before)).toContain("linear-gradient(to right");
    expect(flat(after)).toContain("linear-gradient(to left");
    expect(flat(after)).not.toContain("linear-gradient(to right");
    // The arch moves to the left edge, rounded on its right side; the salon's name and link are anchored to the right margin.
    expect(imageStyle(after, portrait.photo!)).toMatchObject({ left: 0, borderLeft: "none" });
    expect(imageStyle(before, portrait.photo!)).toMatchObject({ borderRight: "none" });
    expect(textStyle(after, "Salong Eko")).toMatchObject({ right: 64 });
    expect(textStyle(before, "Salong Eko")).toMatchObject({ left: 64 });
    // The text block is right-aligned, and the QR code moves to the left corner.
    expect(find(after, (node) => node.props.style?.textAlign === "right")).toMatchObject({ alignItems: "flex-end" });
    expect(find(after, (node) => node.props.style?.bottom === 40)).toMatchObject({ left: 64 });
    expect(find(before, (node) => node.props.style?.bottom === 40)).toMatchObject({ right: 64 });
  });

  it("keeps a cut-out person's face clear of the text column when mirrored", () => {
    const column = Math.round(1080 * 0.58);
    for (const [height, textTop] of [[1920, 1500], [1350, 500]] as const) {
      const standardPlace = cutoutPlacement({ width: 3, height: 4 }, 1080, height, textTop);
      const place = cutoutPlacement({ width: 3, height: 4 }, 1080, height, textTop, true);
      // The same person and size on the other side, with the same decision about the headline.
      expect(place).toMatchObject({ clear: standardPlace.clear, width: standardPlace.width, height: standardPlace.height, top: standardPlace.top });
      expect(place.left + place.width).toBe(1080 - standardPlace.left);
      // The head and face (the middle of the person) lie left of where the right-hand text column starts.
      expect(place.left + place.width / 2).toBeLessThan(1080 - 64 - column);
    }
    const png = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 3, 0x20, 0, 0, 4, 0x2c, 8, 6, 0, 0, 0]).toString("base64")}`;
    const person = posterDataSchema.parse({ ...input, photo: png, cutout: true, arrangement: "mirrored", headline: "friskvårdsbidrag" });
    const style = imageStyle(posterTree("portrait", person, "post"), png);
    expect(Number(style.left) + Number(style.width) / 2).toBeLessThan(1080 - 64 - column);
  });

  it("puts the full photo's text on a panel at the top, the photo below it and the salon's chip at the bottom", () => {
    for (const [format, top, bottom] of [["post", 64, 64], ["story", 290, 430]] as const) {
      const tree = posterTree("fullphoto", mirrored, format);
      expect(textStyle(tree, "Salong Eko")).toMatchObject({ bottom });
      expect(textStyle(tree, "Salong Eko")).not.toHaveProperty("top");
      const block = find(tree, (node) => node.props.style?.flexDirection === "column" && node.props.style.alignItems === "flex-start");
      expect(block).toMatchObject({ top });
      expect(block).not.toHaveProperty("bottom");
      // The photo starts below the text panel, so no text ever lies over a face in the photo.
      expect(Number(find(tree, (node) => node.type === "img").top)).toBeGreaterThan(top);
      expect(flat(tree)).not.toContain("linear-gradient");
    }
    expect(textStyle(posterTree("fullphoto", standard, "post"), "Salong Eko")).toMatchObject({ top: 64 });
  });

  it("keeps everything of the mirrored full photo story inside the safe zones, for long texts and a QR code too", () => {
    const heavy = posterDataSchema.parse({ ...standard, arrangement: "mirrored", price: "", headline: "Friskvårdsmassage för nacke och axlar", detail: "x".repeat(120), signature: { ...standard.signature, qr: "https://salongeko.example/boka" }, textSize: "large" });
    for (const data of [mirrored, heavy]) {
      const placed = nodes(posterTree("fullphoto", data, "story")).map((node) => node.props.style).filter((style) => style?.position === "absolute" && (style.top !== undefined || style.bottom !== undefined));
      for (const style of placed) {
        if (style!.top !== undefined && style!.width !== 1080) expect(Number(style!.top)).toBeGreaterThanOrEqual(STORY_SAFE.top);
        if (style!.bottom !== undefined) expect(Number(style!.bottom)).toBeGreaterThanOrEqual(STORY_SAFE.bottom);
      }
    }
  });

  it("puts the after photo first on the before/after poster and keeps each label and the arrow right", async () => {
    const before = jpeg.replace("data:image/jpeg", "data:image/png");
    const paired = posterDataSchema.parse({ ...input, before, pair: ["Före", "Efter"], arrangement: "mirrored" });
    const post = posterTree("beforeafter", paired, "post");
    expect(Number(imageStyle(post, paired.photo!).left)).toBeLessThan(Number(imageStyle(post, before).left));
    expect(Number(textStyle(post, "EFTER").left)).toBeLessThan(Number(textStyle(post, "FÖRE").left));
    expect(Number(textStyle(post, "EFTER").left)).toBeLessThan(Number(imageStyle(post, before).left));
    expect(find(post, (node) => node.props.children !== undefined && node.props.style?.width === 96)).toMatchObject({ transform: "rotate(180deg)" });
    const story = posterTree("beforeafter", paired, "story");
    expect(Number(imageStyle(story, paired.photo!).top)).toBeLessThan(Number(imageStyle(story, before).top));
    expect(Number(textStyle(story, "EFTER").top)).toBeLessThan(Number(imageStyle(story, before).top));
    expect(find(story, (node) => node.props.style?.width === 96)).toMatchObject({ transform: "rotate(-90deg)" });
    expect(find(posterTree("beforeafter", { ...paired, arrangement: "standard" }, "post"), (node) => node.props.style?.width === 96)).toMatchObject({ transform: "none" });
  });

  it("leaves the other templates unchanged", () => {
    for (const template of ["pricelist", "season", "review", "slots", "typography"] as const) {
      expect(flat(posterTree(template, mirrored, "post"))).toBe(flat(posterTree(template, standard, "post")));
    }
  });
});
