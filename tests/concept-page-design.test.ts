import { describe, expect, it } from "vitest";
import { reduce } from "@/concept/actions";
import { bookingShare } from "@/concept/booking/share";
import { bookingHome, giftCardLink, myBookingsFor, rebookLink, widgetPath } from "@/concept/booking/links";
import { buildIntentContext } from "@/concept/command/intent-context";
import { proposalFor } from "@/concept/command/proposal";
import { createDemoState, DEMO_VERSION } from "@/concept/data/generate";
import { translate } from "@/concept/i18n";
import { interpretCommand } from "@/concept/intent";
import { applyAction } from "@/concept/log/capture";
import { undoEntry } from "@/concept/log/undo";
import { moduleById, monthlyTotal } from "@/concept/modules/registry";
import { subdomainHost } from "@/concept/page/address";
import { DEFAULT_PAGE, normalizePage, pageCss } from "@/concept/page/config";
import { designRequest } from "@/concept/page/design-request";
import { changedAspects } from "@/concept/page/diff";
import { resolveHost } from "@/concept/page/resolve";
import { addSectionAfter } from "@/concept/page/sections";
import { applyTemplate, isTemplateId, TEMPLATE_IDS, TEMPLATES, templateIdOf } from "@/concept/page/templates";
import { buildTokens, contrast, mix } from "@/concept/page/colour";
import { FONT_PAIRS, PALETTES, PHOTOS, standaloneFont } from "@/concept/page/theme";

const today = "2026-11-17";
const clock = { today, minutes: 10 * 60 };
const state = createDemoState(today);
const meta = { actor: "owner", source: "button", at: 0 } as const;
const ask = (text: string, from = state, role: "owner" | "staff" = "owner") => proposalFor(from, interpretCommand(text, buildIntentContext(from, today, clock.minutes)), text, clock, [], role);
const kinds = (page: typeof DEFAULT_PAGE) => page.sections.map((s) => s.kind);

describe("page design requests", () => {
  it("makes it calmer and more luxurious", () => {
    const request = designRequest("Make it calmer and more luxurious", DEFAULT_PAGE);
    expect(request).toMatchObject({ kind: "page" });
    const { theme } = (request as { page: typeof DEFAULT_PAGE }).page;
    expect(theme).toMatchObject({ colors: PALETTES.sand, fonts: "elegant", corners: "soft" });
  });

  it("reads single moods", () => {
    const theme = (text: string) => (designRequest(text, DEFAULT_PAGE) as { page: typeof DEFAULT_PAGE }).page.theme;
    expect(theme("make the page more luxurious")).toMatchObject({ fonts: "elegant", corners: "sharp", colors: PALETTES.ink });
    expect(theme("make it warmer and friendlier")).toMatchObject({ colors: PALETTES.rose, corners: "round" });
    expect(theme("give the site a cleaner, modern look")).toMatchObject({ colors: PALETTES.sky });
    expect(theme("can you make the page darker")).toMatchObject({ colors: PALETTES.ink });
    expect(theme("use rounder corners")).toMatchObject({ corners: "round" });
    expect(theme("I want sharp corners on the page")).toMatchObject({ corners: "sharp" });
  });

  it("puts a section first, adds and removes sections", () => {
    const first = designRequest("Put reviews first", DEFAULT_PAGE) as { page: typeof DEFAULT_PAGE };
    expect(kinds(first.page)).toEqual(["hero", "reviews", "treatments", "staff", "map", "giftcards"]);
    expect(kinds((designRequest("show the gallery at the top", DEFAULT_PAGE) as { page: typeof DEFAULT_PAGE }).page)).toEqual(["hero", "gallery", "treatments", "staff", "reviews", "map", "giftcards"]);
    expect(kinds((designRequest("add an FAQ to the page", DEFAULT_PAGE) as { page: typeof DEFAULT_PAGE }).page)).toContain("faq");
    expect(kinds((designRequest("remove the gift cards", DEFAULT_PAGE) as { page: typeof DEFAULT_PAGE }).page)).not.toContain("giftcards");
    expect(designRequest("put reviews first", first.page)).toBeNull();
  });

  it("uses the colours from the logo, or asks for the logo", () => {
    expect(designRequest("use the colours from our logo", DEFAULT_PAGE)).toEqual({ kind: "needs-logo" });
    const withLogo = normalizePage({ ...DEFAULT_PAGE, theme: { ...DEFAULT_PAGE.theme, logoColors: ["#8a3b5c", "#223344"] } });
    const request = designRequest("use the colours from our logo", withLogo) as { page: typeof DEFAULT_PAGE };
    expect(request.page.theme.colors).toMatchObject({ accent: "#8a3b5c" });
    expect(request.page.theme.colors?.background).toBe("#f7f4ef");
  });

  it("leaves other requests alone", () => {
    for (const text of ["book Lena for a massage tomorrow", "how much did we earn last month", "what is on today", "cancel the 10:00 booking", ""]) {
      expect(designRequest(text, DEFAULT_PAGE), text).toBeNull();
    }
  });
});

describe("ready-made designs", () => {
  it("are pages an owner could have built by hand: known sections, fonts, photos and corners", () => {
    for (const id of TEMPLATE_IDS) {
      const page = applyTemplate(DEFAULT_PAGE, id);
      expect(page.sections, id).toEqual(TEMPLATES[id].sections);
      expect(page.theme, id).toMatchObject(TEMPLATES[id].theme);
      expect(FONT_PAIRS[page.theme.fonts], id).toBeDefined();
      expect(PHOTOS[page.theme.heroPhoto], id).toBeDefined();
      expect(kinds(page)[0], id).toBe("hero");
      expect(kinds(page), id).toContain("treatments");
    }
  });

  it("look different from each other", () => {
    expect(new Set(TEMPLATE_IDS.map((id) => JSON.stringify(TEMPLATES[id].theme.colors))).size).toBe(TEMPLATE_IDS.length);
    expect(new Set(TEMPLATE_IDS.map((id) => TEMPLATES[id].theme.fonts)).size).toBe(TEMPLATE_IDS.length);
  });

  it("differ in how the sections are drawn, and an unknown style falls back to cards", () => {
    expect(TEMPLATE_IDS.map((id) => applyTemplate(DEFAULT_PAGE, id).theme.style)).toEqual(["boxed", "lined", "lined", "soft"]);
    expect(normalizePage({ ...DEFAULT_PAGE, theme: { ...DEFAULT_PAGE.theme, style: "x" as never } }).theme.style).toBe("boxed");
    expect(changedAspects(DEFAULT_PAGE, { ...DEFAULT_PAGE, theme: { ...DEFAULT_PAGE.theme, style: "lined" } })).toEqual(["style"]);
  });

  it("keep what is the owner's: logo, logo colours, Instagram name and own CSS", () => {
    const logo = "data:image/png;base64,AAAA";
    const own = normalizePage({ ...DEFAULT_PAGE, theme: { ...DEFAULT_PAGE.theme, logo, logoColors: ["#8a3b5c"] }, instagram: "salong.eko", css: "h1 { color: red }" });
    const next = applyTemplate(own, "noir");
    expect(next.theme).toMatchObject({ logo, logoColors: ["#8a3b5c"], colors: PALETTES.ink, corners: "sharp" });
    expect(next).toMatchObject({ instagram: "salong.eko", css: "h1 { color: red }" });
  });

  it("keep secondary text and the accent readable on the soft style's tinted cards", () => {
    // tenant-theme.css draws a soft card as half the accent tint over the surface.
    for (const id of Object.keys(PALETTES) as (keyof typeof PALETTES)[]) {
      const { tokens } = buildTokens(PALETTES[id]);
      const card = mix(tokens.accentSoft, tokens.surface, 0.5);
      expect(contrast(tokens.muted, card), `${id} muted`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens.accent, card), `${id} accent`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens.ink, card), `${id} text`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("give posters a heading font they can carry on their own", () => {
    for (const id of Object.keys(FONT_PAIRS) as (keyof typeof FONT_PAIRS)[]) expect(standaloneFont(FONT_PAIRS[id].heading)).not.toContain("var(");
    expect(standaloneFont(FONT_PAIRS.couture.heading)).toBe('"Didot", "Bodoni MT", Georgia, serif');
    expect(standaloneFont(FONT_PAIRS.classic.heading)).toBe(FONT_PAIRS.classic.heading);
  });

  it("keep the owner's About section and text, after the team", () => {
    const about = { heading: "Our story", text: "Two people and a quiet room." };
    const own = normalizePage({ ...DEFAULT_PAGE, sections: addSectionAfter(DEFAULT_PAGE.sections, "about", "hero"), about });
    const next = applyTemplate(own, "atelier");
    expect(next.about).toEqual(about);
    expect(next.sections).toEqual(addSectionAfter(applyTemplate(DEFAULT_PAGE, "atelier").sections, "about", "staff"));
    expect(templateIdOf(next)).toBe("atelier");
    expect(applyTemplate(DEFAULT_PAGE, "atelier").sections.some((section) => section.kind === "about")).toBe(false);
  });

  it("are recognised until the owner changes something", () => {
    const noir = applyTemplate(DEFAULT_PAGE, "noir");
    expect(templateIdOf(noir)).toBe("noir");
    expect(templateIdOf({ ...noir, theme: { ...noir.theme, corners: "round" } })).toBeNull();
    expect(templateIdOf(DEFAULT_PAGE)).toBeNull();
  });

  it("only accept known names from a link", () => {
    expect(isTemplateId("atelier")).toBe(true);
    for (const value of ["", "toString", "__proto__", "Noir", null, undefined, 3]) expect(isTemplateId(value), String(value)).toBe(false);
  });
});

describe("design proposal", () => {
  it("is a change with a before and after preview that only edits the page", () => {
    const proposal = ask("make it calmer and more luxurious");
    if (proposal.kind !== "change") throw new Error(`expected a change, got ${proposal.kind}`);
    expect(proposal.action.type).toBe("page/set");
    expect(proposal.preview?.before).toEqual(state.page);
    expect(proposal.preview?.after.theme.fonts).toBe("elegant");
    expect(proposal.rows.map((row) => row.label)).toEqual(["colours", "fonts"]);
    expect(proposal.rows[0]).toMatchObject({ before: "Forest green", after: "Calm sand" });
    expect(state.page.theme.colors).toEqual(PALETTES.forest);
  });

  it("lists the section order for 'put reviews first'", () => {
    const proposal = ask("put reviews first");
    if (proposal.kind !== "change") throw new Error("expected a change");
    expect(proposal.rows).toEqual([{ label: "sections", before: expect.stringContaining("Treatments and prices, Team, About us, Reviews"), after: expect.stringContaining("Top of the page, Reviews, Treatments") }]);
  });

  it("points to the editor when the logo is missing", () => {
    expect(ask("use the colours from our logo")).toMatchObject({ kind: "message", link: { href: "/studio/more/booking-page" } });
  });

  it("is for the owner only", () => {
    expect(ask("make it calmer and more luxurious", state, "staff").kind).not.toBe("change");
  });

  it("approving applies it, logs it, and undo takes it back", () => {
    const proposal = ask("make it more luxurious");
    if (proposal.kind !== "change") throw new Error("expected a change");
    const applied = applyAction(state, proposal.action, { ...meta, actor: "ai", source: "assistant" });
    expect(applied.page.theme.fonts).toBe("elegant");
    expect(applied.log[0]).toMatchObject({ type: "page/set", actor: "ai", source: "assistant", summary: "Changed the booking page: colours, fonts, corners" });
    const undone = undoEntry(applied, applied.log[0].id);
    expect(undone.page).toEqual(state.page);
  });
});

describe("page actions", () => {
  it("only stores a normalised page, and the CSS that is rendered is always the sanitised one", () => {
    const hostile = { ...DEFAULT_PAGE, theme: { ...DEFAULT_PAGE.theme, fonts: "x" as never, logo: "javascript:alert(1)" }, css: "</style><script>alert(1)</script> h1 { color: red; background: url(https://evil.example/x.png) }" };
    const next = reduce(state, { type: "page/set", page: hostile });
    expect(next.page.theme.fonts).toBe("modern");
    expect(next.page.theme.logo).toBeNull();
    expect(pageCss(next.page)).toBe("");
    expect(pageCss(reduce(state, { type: "page/set", page: { ...hostile, css: "h1 { color: red }" } }).page)).toBe(".booking-theme h1{color:red}");
  });

  it("changes nothing when nothing changed", () => {
    expect(reduce(state, { type: "page/set", page: state.page })).toBe(state);
  });

  it("picks a subdomain that then resolves to the business", () => {
    const next = reduce(state, { type: "salon/slug", slug: "Kajsa-Fotvard" });
    expect(next.salon.slug).toBe("kajsa-fotvard");
    const host = subdomainHost(next.salon.slug);
    expect(resolveHost(host)).toEqual({ kind: "business", slug: "kajsa-fotvard", via: "subdomain" });
    expect(bookingHome(next.salon.slug)).toBe("/boka/kajsa-fotvard");
  });

  it("refuses reserved, taken and malformed slugs", () => {
    for (const slug of ["admin", "www", "klippet", "a", "has space", "-x-", ""]) expect(reduce(state, { type: "salon/slug", slug }), slug).toBe(state);
    expect(reduce(state, { type: "salon/slug", slug: state.salon.slug })).toBe(state);
  });

  it("starts an own domain only with the module on, and walks the three steps", () => {
    const connect = { type: "domain/connect", host: "https://Boka.SalongEko.se/" } as const;
    expect(reduce(state, connect)).toBe(state);
    const on = reduce(state, { type: "module/toggle", key: "domain" });
    const added = reduce(on, connect);
    expect(added.domain).toEqual({ host: "boka.salongeko.se", status: "waiting-dns" });
    expect(reduce(added, connect)).toBe(added);
    const verifying = reduce(added, { type: "domain/check" });
    expect(verifying.domain?.status).toBe("verifying");
    const secure = reduce(verifying, { type: "domain/check" });
    expect(secure.domain?.status).toBe("secure");
    expect(reduce(secure, { type: "domain/check" })).toBe(secure);
    expect(reduce(added, { type: "domain/check", status: "secure" }).domain?.status).toBe("secure");
    expect(reduce(secure, { type: "domain/remove" }).domain).toBeNull();
    expect(reduce(on, { type: "domain/connect", host: "salongeko.se" })).toBe(on);
    expect(reduce(on, { type: "domain/check" })).toBe(on);
  });

  it("logs the address and domain changes", () => {
    const slug = applyAction(state, { type: "salon/slug", slug: "kajsa" }, meta);
    expect(slug.log[0]).toMatchObject({ summary: "Changed the booking link", before: "salong-eko", after: "kajsa" });
    expect(undoEntry(slug, slug.log[0].id).salon.slug).toBe("salong-eko");
    const on = reduce(state, { type: "module/toggle", key: "domain" });
    const added = applyAction(on, { type: "domain/connect", host: "boka.salongeko.se" }, meta);
    expect(added.log[0].summary).toBe("Started connecting boka.salongeko.se");
    const checked = applyAction(added, { type: "domain/check" }, meta);
    expect(checked.log[0].summary).toBe("boka.salongeko.se is now: Verifying");
    expect(undoEntry(checked, checked.log[0].id).domain?.status).toBe("waiting-dns");
  });
});

describe("own domain module and demo data", () => {
  it("is a paid module that is off by default", () => {
    expect(moduleById("domain").priceSek).toBeGreaterThan(0);
    expect(state.modules.domain).toBe(false);
    expect(monthlyTotal(["domain"])).toBeGreaterThan(monthlyTotal([]));
  });

  it("starts with Salong Eko in the Eko design with its About text and no domain, in a new demo version", () => {
    const eko = applyTemplate(DEFAULT_PAGE, "eko");
    expect(state.page).toEqual({ ...eko, sections: addSectionAfter(eko.sections, "about", "staff"), about: { heading: "", text: translate("en", "fixture.eko.about") } });
    expect(state.page.theme.colors).toEqual(PALETTES.forest);
    expect(DEFAULT_PAGE.theme.colors).toBeNull();
    expect(state.domain).toBeNull();
    expect(state.version).toBe(DEMO_VERSION);
  });
});

describe("links follow the slug", () => {
  it("builds every customer route from it", () => {
    expect(widgetPath("kajsa")).toBe("/boka/kajsa/widget");
    expect(myBookingsFor("kajsa", "c 1")).toBe("/boka/kajsa/me?ref=c%201");
    expect(rebookLink("kajsa", "s-1")).toBe("/boka/kajsa?service=s-1#book");
    expect(giftCardLink("kajsa", { code: "A", amount: 100, recipient: "B", message: "" })).toMatch(/^\/boka\/kajsa\/gift\?/);
    const share = bookingShare("https://x.example/anything", "kajsa", "Kajsa");
    expect(share).toMatchObject({ link: "https://x.example/boka/kajsa", widget: "https://x.example/boka/kajsa/widget" });
  });
});
