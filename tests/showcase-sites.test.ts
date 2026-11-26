import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BRAND } from "@/concept/brand";
import { conceptRoute } from "@/concept/page/language";
import { CLASSIC_PALETTE } from "@/concept/showcase/klassisk/palette";
import { KlassiskSite } from "@/concept/showcase/klassisk/klassisk-site";
import { hoursThisWeek, kronor, menuOf, openingHours, PACK_MENU, SALON, SHOWCASE_SLUG, telHref } from "@/concept/showcase/salon";
import { StandaloneBooking } from "@/concept/showcase/standalone";
import { BOLD_PALETTE } from "@/concept/showcase/vagad/palette";
import { VagadSite } from "@/concept/showcase/vagad/vagad-site";
import { DEFAULT_PACK, getPack } from "@/concept/packs";

const pages = {
  klassisk: () => renderToStaticMarkup(createElement(KlassiskSite)),
  vagad: () => renderToStaticMarkup(createElement(VagadSite)),
  "klassisk/boka": () => renderToStaticMarkup(createElement(StandaloneBooking, { styles: {}, home: "/showcase/salong-klassisk", themeKey: "k", initialTheme: "light", palette: CLASSIC_PALETTE, corners: "soft" })),
  "vagad/boka": () => renderToStaticMarkup(createElement(StandaloneBooking, { styles: {}, home: "/showcase/salong-vagad", themeKey: "v", initialTheme: "dark", palette: BOLD_PALETTE, corners: "sharp" })),
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? sourceFiles(full) : [full];
  });
}

describe("the showcase salon sites", () => {
  it("never show the platform's name", () => {
    for (const [name, render] of Object.entries(pages)) {
      expect(render().toLowerCase(), name).not.toContain(BRAND.name.toLowerCase());
    }
  });

  it("draw nothing from the platform's brand: no wordmark, product copy or brand constants", () => {
    const root = path.join(__dirname, "..", "src");
    const files = [...sourceFiles(path.join(root, "concept", "showcase")), ...sourceFiles(path.join(root, "app", "showcase"))];
    expect(files.length).toBeGreaterThan(10);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/\/brand"|ui\/wordmark|site\/copy|brand-assets|Instrument_Serif|\bInter\b/);
    }
  });

  it("have one way to book on the homepage and a booking area to land on", () => {
    for (const name of ["klassisk", "vagad"] as const) {
      const html = pages[name]();
      expect(html, name).toContain('id="boka"');
      expect(html, name).toContain("Boka tid");
      expect(html, name).not.toMatch(/Get started|Kom igång/);
      expect(html, name).not.toContain("Berätta vad du vill boka");
      expect(html, name).toContain("Till behandlingarna");
    }
  });

  it("starts the standalone booking page with the treatment list, not an empty search", () => {
    for (const name of ["klassisk/boka", "vagad/boka"] as const) {
      const html = pages[name]();
      expect(html, name).toContain("Medicinsk fotvård");
      expect(html, name).not.toContain("Berätta vad du vill boka");
    }
  });

  it("are the demo salon's own: its name, address, services and prices", () => {
    expect(SHOWCASE_SLUG).toBe("salong-eko");
    for (const name of ["klassisk", "vagad"] as const) {
      const html = pages[name]();
      expect(html).toContain(SALON.name);
      expect(html).toContain(SALON.address);
      expect(html).toContain("Medicinsk fotvård");
      expect(html).toContain(kronor(795));
    }
    expect(PACK_MENU.flatMap((group) => group.items).length).toBe(getPack(DEFAULT_PACK).services.filter((service) => !service.hidden).length);
  });

  it("list prices in Swedish kronor and only the services customers may book", () => {
    expect(kronor(1195)).toBe("1 195 kr");
    const [first] = getPack(DEFAULT_PACK).services;
    expect(menuOf([{ ...first, hidden: true }])).toEqual([]);
    expect(menuOf([first])[0].items[0].name).toBe("Medicinsk fotvård");
  });

  it("run opening hours together and mark the closed day", () => {
    expect(openingHours()).toEqual([
      { days: "Måndag–onsdag", hours: "9–18" },
      { days: "Torsdag", hours: "9–19" },
      { days: "Fredag", hours: "9–17" },
      { days: "Lördag", hours: "10–15" },
      { days: "Söndag", hours: null },
    ]);
    expect(telHref("070-174 06 50")).toBe("tel:+46701740650");
  });

  it("show the week the booking keeps: a one-off opening and a closed day replace the usual hours", () => {
    // Thursday 26 November 2026. The demo opens the next day nine to six whatever the weekday usually keeps.
    const salon = {
      ...SALON,
      openings: [{ date: "2026-11-27", open: 9 * 60, close: 18 * 60 }],
      closures: [{ id: "c1", date: "2026-11-28", name: "" }],
    };
    expect(openingHours(hoursThisWeek(salon, "2026-11-26"))).toEqual([
      { days: "Måndag–onsdag", hours: "9–18" },
      { days: "Torsdag", hours: "9–19" },
      { days: "Fredag", hours: "9–18" },
      { days: "Lördag–söndag", hours: null },
    ]);
    expect(openingHours(hoursThisWeek(SALON, "2026-11-26"))).toEqual(openingHours());
  });

  it("keep the platform's install metadata out of every layout that sets its own", () => {
    const app = path.join(__dirname, "..", "src", "app", "showcase");
    const layouts = sourceFiles(app).filter((file) => file.endsWith("layout.tsx"));
    expect(layouts.length).toBe(3);
    for (const file of layouts) expect(readFileSync(file, "utf8"), file).toMatch(/export const metadata: Metadata = \{\n(\s*\/\/.*\n)*\s*\.\.\.TENANT_METADATA,/);
  });

  it("are treated like a business's own pages: no platform banner", () => {
    for (const route of ["/showcase", "/showcase/salong-klassisk", "/showcase/salong-vagad/boka"]) expect(conceptRoute(route), route).toBe("booking");
    expect(conceptRoute("/showcasex")).toBeNull();
  });
});
