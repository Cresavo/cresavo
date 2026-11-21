import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { shortLink } from "@/concept/campaigns/poster-engine/client";
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
