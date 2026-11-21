import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { qrLink, shortLink } from "@/concept/campaigns/poster-engine/client";
import { renderPosterSvg } from "@/concept/campaigns/poster-engine/render";
import { posterDataSchema, posterTree } from "@/concept/campaigns/poster-engine/templates";

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
    expect(qrLink("salongeko.example/c/x")).toBe("https://salongeko.example/c/x");
    expect(qrLink("https://eko.example")).toBe("https://eko.example");
    expect(qrLink("http://eko.example")).toBeUndefined();
    expect(qrLink(undefined)).toBeUndefined();
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

  it("shows the wellness badges on the price poster", () => {
    expect(flat(posterTree("price", data, "post"))).toContain("Epassi");
    expect(flat(posterTree("price", { ...data, badges: [] }, "post"))).not.toContain("Epassi");
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
