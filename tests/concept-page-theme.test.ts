import { describe, expect, it } from "vitest";
import { buildTokens, contrast, contrastReport, isHex, luminance, mix, onColour, readable } from "@/concept/page/colour";
import { DEFAULT_PAGE, cleanInstagram, normalizePage } from "@/concept/page/config";
import { dominantColours } from "@/concept/page/logo-colours";
import { DEFAULT_SECTIONS, addSection, availableKinds, moveSection, moveToFirst, normalizeSections, removeSection, setVariant } from "@/concept/page/sections";
import { DEFAULT_THEME, PALETTES, MAX_LOGO_LENGTH, normalizeTheme, paletteIdOf, themeVariables } from "@/concept/page/theme";

describe("contrast", () => {
  it("matches the WCAG reference values", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
    expect(luminance("#ffffff")).toBeCloseTo(1, 5);
  });

  it("leaves readable colours alone and moves faint ones just far enough", () => {
    expect(readable("#222222", ["#ffffff"], 4.5)).toBe("#222222");
    const fixed = readable("#bbbbbb", ["#ffffff"], 4.5);
    expect(fixed).not.toBe("#bbbbbb");
    expect(contrast(fixed, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(fixed, "#ffffff")).toBeLessThan(4.7);
    const lifted = readable("#333333", ["#111111"], 4.5);
    expect(contrast(lifted, "#111111")).toBeGreaterThanOrEqual(4.5);
  });

  it("falls back to black or white when the colours cannot be reconciled", () => {
    expect(readable("#808080", ["#7f7f7f"], 21)).toMatch(/^#(?:000000|ffffff)$/);
    expect(onColour("#ffffff")).toBe("#000000");
    expect(onColour("#101010")).toBe("#ffffff");
  });

  it("builds tokens where every pair passes AA, whatever the owner picks", () => {
    const picks = [
      { background: "#ffffff", text: "#cccccc", accent: "#ffff00" },
      { background: "#000000", text: "#222222", accent: "#110011" },
      { background: "#808080", text: "#888888", accent: "#8a8a8a" },
      { background: "#ff00ff", text: "#ff44ff", accent: "#00ff00" },
      ...Object.values(PALETTES),
    ];
    for (const palette of picks) {
      const { tokens } = buildTokens(palette);
      for (const row of contrastReport(tokens)) expect(row.ratio, `${row.label} for ${JSON.stringify(palette)}`).toBeGreaterThanOrEqual(4.5);
      for (const value of Object.values(tokens)) expect(isHex(value)).toBe(true);
    }
  });

  it("reports which chosen colours had to change, and not the ones that were fine", () => {
    expect(buildTokens(PALETTES.sand).adjustments).toEqual([]);
    const { adjustments, tokens } = buildTokens({ background: "#ffffff", text: "#202020", accent: "#ffee00" });
    expect(adjustments.map((a) => a.role)).toEqual(["accent"]);
    expect(adjustments[0].from).toBe("#ffee00");
    expect(adjustments[0].to).toBe(tokens.accent);
  });

  it("mixes colours", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
});

describe("theme", () => {
  it("sets nothing for the default look", () => {
    expect(themeVariables(DEFAULT_THEME)).toEqual({});
  });

  it("turns a custom theme into the tenant's own tokens, with the page's own font", () => {
    const vars = themeVariables({ ...DEFAULT_THEME, colors: PALETTES.ink, fonts: "elegant" });
    expect(vars["--ui-bg"]).toBe("#17181a");
    expect(vars["--ui-action"]).toMatch(/^#[0-9a-f]{6}$/);
    expect(Object.keys(vars).some((name) => /--ui-(success|warning|danger|info)/.test(name))).toBe(false);
    expect(vars.colorScheme).toBe("dark");
    expect(vars["--page-font-heading"]).toContain("Palatino");
    expect(themeVariables({ ...DEFAULT_THEME, colors: PALETTES.sand }).colorScheme).toBe("light");
  });

  it("falls back to the default for anything it does not know", () => {
    const theme = normalizeTheme({ fonts: "comic" as never, corners: "pointy" as never, heroPhoto: "../x" as never, colors: { background: "red", text: "#000", accent: "#12345g" }, logo: "https://evil.example/x.png", logoColors: ["#abc", "#AABBCC", "nope", "#112233", "#445566", "#778899"] });
    expect(theme).toEqual({ ...DEFAULT_THEME, logoColors: ["#aabbcc", "#112233", "#445566"] });
  });

  it("accepts only small raster data URLs as a logo", () => {
    const ok = "data:image/png;base64,iVBORw0KGgo=";
    expect(normalizeTheme({ logo: ok }).logo).toBe(ok);
    for (const logo of ["data:image/svg+xml;base64,PHN2Zz4=", "data:text/html;base64,PHNjcmlwdD4=", "javascript:alert(1)", `data:image/png;base64,${"A".repeat(MAX_LOGO_LENGTH)}`, "data:image/png;base64,AAAA\" onerror=\"x"]) {
      expect(normalizeTheme({ logo }).logo).toBeNull();
    }
  });

  it("knows a ready-made palette when it sees one", () => {
    expect(paletteIdOf(PALETTES.rose)).toBe("rose");
    expect(paletteIdOf({ ...PALETTES.rose, accent: "#000000" })).toBeNull();
    expect(paletteIdOf(null)).toBeNull();
  });
});

describe("logo colours", () => {
  const pixels = (...colours: [number, number, number, number][]) => Uint8ClampedArray.from(colours.flat());

  it("picks the strongest colours and skips white, black, grey and transparent", () => {
    const data = pixels(...[
      ...Array(30).fill([200, 40, 40, 255]),
      ...Array(20).fill([40, 60, 200, 255]),
      ...Array(100).fill([255, 255, 255, 255]),
      ...Array(100).fill([10, 10, 10, 255]),
      ...Array(100).fill([128, 128, 128, 255]),
      ...Array(100).fill([0, 255, 0, 0]),
    ] as [number, number, number, number][]);
    expect(dominantColours(data)).toEqual(["#c82828", "#283cc8"]);
  });

  it("merges near-identical shades and returns nothing for a grey logo", () => {
    expect(dominantColours(pixels([200, 40, 40, 255], [205, 45, 45, 255], [198, 42, 38, 255]))).toHaveLength(1);
    expect(dominantColours(pixels([100, 100, 100, 255]))).toEqual([]);
  });
});

describe("sections", () => {
  const kinds = (list: { kind: string }[]) => list.map((s) => s.kind);

  it("starts with the page the booking site always had", () => {
    expect(kinds(DEFAULT_SECTIONS)).toEqual(["hero", "treatments", "giftcards", "reviews", "map"]);
    expect(DEFAULT_PAGE.sections).toBe(DEFAULT_SECTIONS);
  });

  it("adds a section once, with its first look, and offers only what is missing", () => {
    const withFaq = addSection(DEFAULT_SECTIONS, "faq");
    expect(withFaq.at(-1)).toEqual({ kind: "faq", variant: "open" });
    expect(addSection(withFaq, "faq")).toEqual(withFaq);
    expect(availableKinds(DEFAULT_SECTIONS)).toEqual(["staff", "gallery", "faq", "instagram"]);
    expect(availableKinds(withFaq)).not.toContain("faq");
  });

  it("removes and reorders without losing or duplicating anything", () => {
    expect(kinds(removeSection(DEFAULT_SECTIONS, "reviews"))).toEqual(["hero", "treatments", "giftcards", "map"]);
    expect(kinds(moveSection(DEFAULT_SECTIONS, "reviews", -1))).toEqual(["hero", "treatments", "reviews", "giftcards", "map"]);
    expect(kinds(moveSection(DEFAULT_SECTIONS, "reviews", 1))).toEqual(["hero", "treatments", "giftcards", "map", "reviews"]);
    expect(kinds(moveSection(DEFAULT_SECTIONS, "map", 1))).toEqual(kinds(DEFAULT_SECTIONS));
    expect(kinds(moveSection(DEFAULT_SECTIONS, "faq", 1))).toEqual(kinds(DEFAULT_SECTIONS));
  });

  it("keeps the hero on top, whatever is moved", () => {
    expect(kinds(moveSection(DEFAULT_SECTIONS, "treatments", -1))).toEqual(kinds(DEFAULT_SECTIONS));
    expect(kinds(moveToFirst(DEFAULT_SECTIONS, "reviews"))).toEqual(["hero", "reviews", "treatments", "giftcards", "map"]);
    expect(kinds(moveToFirst(removeSection(DEFAULT_SECTIONS, "hero"), "map"))).toEqual(["map", "treatments", "giftcards", "reviews"]);
    expect(kinds(moveToFirst(DEFAULT_SECTIONS, "gallery"))).toEqual(["hero", "gallery", "treatments", "giftcards", "reviews", "map"]);
  });

  it("changes a look only to one the section has", () => {
    expect(setVariant(DEFAULT_SECTIONS, "reviews", "quote").find((s) => s.kind === "reviews")?.variant).toBe("quote");
    expect(setVariant(DEFAULT_SECTIONS, "reviews", "neon")).toEqual(DEFAULT_SECTIONS);
  });

  it("cleans a list from outside", () => {
    expect(normalizeSections([{ kind: "reviews", variant: "neon" }, { kind: "reviews", variant: "quote" }, { kind: "script" as never, variant: "x" }, null as never, { kind: "hero", variant: "plain" }])).toEqual([
      { kind: "hero", variant: "plain" },
      { kind: "reviews", variant: "cards" },
    ]);
    expect(normalizeSections(undefined)).toEqual([]);
    expect(normalizePage({}).sections).toEqual(DEFAULT_SECTIONS);
  });
});

describe("page config", () => {
  it("cleans an Instagram name", () => {
    expect(cleanInstagram("@Salong.Eko")).toBe("salong.eko");
    expect(cleanInstagram("https://www.instagram.com/salong.eko/?hl=sv")).toBe("salong.eko");
    expect(cleanInstagram("javascript:alert(1)")).toBe("");
    expect(cleanInstagram("a b")).toBe("");
    expect(cleanInstagram("x".repeat(31))).toBe("");
  });

  it("normalises everything that enters the state", () => {
    const page = normalizePage({ theme: { ...DEFAULT_THEME, fonts: "x" as never }, sections: [{ kind: "faq", variant: "closed" }], instagram: "@eko", css: "a".repeat(20000) });
    expect(page.theme.fonts).toBe("modern");
    expect(page.sections).toEqual([{ kind: "faq", variant: "closed" }]);
    expect(page.instagram).toBe("eko");
    expect(page.css.length).toBeLessThanOrEqual(8000);
    expect(normalizePage(undefined)).toEqual(DEFAULT_PAGE);
  });
});
