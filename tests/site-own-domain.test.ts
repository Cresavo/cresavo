import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CONTACT_EMAIL } from "@/concept/brand";
import { CNAME_TARGET } from "@/concept/page/domain";
import { SiteLocale } from "@/concept/site/copy";
import { site } from "@/concept/site/en";
import { sitePath } from "@/concept/site/language";
import { OwnDomainPage } from "@/concept/site/own-domain/own-domain-page";
import { bookingOriginFor, type OwnDomainProps } from "@/concept/site/own-domain/props";
import { buttonSnippet, embedSnippet, exampleRecord, MAX_LABEL } from "@/concept/site/own-domain/snippets";
import { sv } from "@/concept/site/sv";

const props: OwnDomainProps = {
  links: { apex: "https://cresavo.example/", demo: "https://demo.cresavo.example/studio" },
  waitlist: null,
  waitlistOpen: false,
  origin: null,
  analyticsEnabled: false,
  bookingOrigin: "https://demo.cresavo.example",
};

const render = (locale: "en" | "sv") =>
  renderToStaticMarkup(createElement(SiteLocale.Provider, { value: locale }, createElement(OwnDomainPage, props)));

describe("the own-domain page", () => {
  it("lives at /own-domain and /sv/own-domain", () => {
    expect(sitePath("en", "own-domain")).toBe("/own-domain");
    expect(sitePath("sv", "own-domain")).toBe("/sv/own-domain");
  });

  it("renders its title, the real CNAME record and one way to contact us, in both languages", () => {
    for (const [locale, copy] of [["en", site], ["sv", sv]] as const) {
      const html = render(locale);
      expect(html).toContain(`<h1 id="hero-heading">${copy["domain.heading"]}</h1>`);
      expect(html).toContain(CNAME_TARGET);
      expect(html).toContain(`${copy["domain.example.host"]}.`);
      expect(html.match(/href="mailto:/g)).toHaveLength(2);
      expect(html).toContain(`mailto:${CONTACT_EMAIL}?subject=`);
      expect(html).toContain(`/site/own-domain/booking-desktop-${locale}.webp`);
    }
  });

  it("shows the studio's own DNS instruction for the example address", () => {
    expect(CNAME_TARGET).toBe("cname.vercel-dns.com");
    expect(exampleRecord("book.salongeko.se")).toEqual({ type: "CNAME", name: "book.salongeko.se.", host: "book.salongeko.se", value: "cname.vercel-dns.com" });
  });
});

describe("the copied code", () => {
  const origin = "https://demo.cresavo.example";

  it("is one line that opens the demo salon's existing booking widget", () => {
    const code = buttonSnippet(origin, "forest", "Boka tid", "Book a time");
    expect(code).not.toContain("\n");
    expect(code).toMatch(/^<a href="https:\/\/demo\.cresavo\.example\/boka\/salong-eko\/widget" target="_blank" rel="noopener" style="[^"]+">Boka tid<\/a>$/);
    expect(code).toContain("background:#2f5d50;color:#ffffff");
  });

  it("escapes the label, falls back to the default and keeps the label short", () => {
    expect(buttonSnippet(origin, "sky", `<img src=x onerror="alert(1)">`, "Book")).toContain(">&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</a>");
    expect(buttonSnippet(origin, "sky", "   ", "Book a time")).toMatch(/>Book a time<\/a>$/);
    const long = "x".repeat(MAX_LABEL + 20);
    expect(buttonSnippet(origin, "sky", long, "Book")).toContain(`>${"x".repeat(MAX_LABEL)}</a>`);
  });

  it("embeds the whole booking with the existing iframe snippet", () => {
    const { code, widget } = embedSnippet(origin, "sv");
    expect(widget).toBe(`${origin}/boka/salong-eko/widget`);
    expect(code).toContain(`<iframe src="${widget}"`);
    expect(code).toContain('title="Boka hos Salong Eko"');
  });

  it("points at the demo's host on the real sites and at this deployment elsewhere", () => {
    expect(bookingOriginFor("https://demo.cresavo.example/studio", "cresavo.example")).toBe("https://demo.cresavo.example");
    expect(bookingOriginFor("/studio", "localhost:3000")).toBe("http://localhost:3000");
    expect(bookingOriginFor("/studio", "preview-abc.vercel.app")).toBe("https://preview-abc.vercel.app");
    expect(bookingOriginFor("/studio", undefined)).toBe("http://localhost");
  });
});
