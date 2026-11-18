import { describe, expect, it } from "vitest";
import { checkOwnSlug, subdomainHost } from "@/concept/page/address";
import { advanceStatus, checkDomain, CNAME_TARGET, dnsInstruction, DOMAIN_STEPS } from "@/concept/page/domain";
import { COMING_SOON_PATH, LANDING_PATH, normalizeHost, ownerViewHref, resolveHost, routeHost, siteLinks, UNKNOWN_PATH, type Directory } from "@/concept/page/resolve";
import { checkSlug, RESERVED_SLUGS, slugify } from "@/concept/page/slug";

const product = "book.example";
const directory: Directory = { domains: { "boka.salongeko.se": "salong-eko" } };

describe("slug", () => {
  it("accepts plain lower-case names", () => {
    expect(checkSlug("salong-eko")).toEqual({ ok: true, slug: "salong-eko" });
    expect(checkSlug("  Kajsa-Hair ")).toEqual({ ok: true, slug: "kajsa-hair" });
    expect(checkSlug("a1b")).toEqual({ ok: true, slug: "a1b" });
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["ab", "short"],
    ["a".repeat(31), "long"],
    ["salong eko", "characters"],
    ["salong_eko", "characters"],
    ["salong.eko", "characters"],
    ["söder", "characters"],
    ["a/b/c", "characters"],
    ["-salong", "edges"],
    ["salong-", "edges"],
    ["sa--long", "edges"],
    ["www", "reserved"],
    ["admin", "reserved"],
    ["xn--bcher-kva", "reserved"],
  ])("refuses %j as %s", (input, problem) => {
    expect(checkSlug(input)).toEqual({ ok: false, problem });
  });

  it("blocks every reserved word and refuses taken names", () => {
    for (const word of RESERVED_SLUGS) expect(checkSlug(word)).toMatchObject({ ok: false });
    expect(checkSlug("klippet", ["klippet"])).toEqual({ ok: false, problem: "taken" });
    expect(checkOwnSlug("klippet", "salong-eko")).toEqual({ ok: false, problem: "taken" });
    expect(checkOwnSlug("salong-eko", "salong-eko")).toEqual({ ok: true, slug: "salong-eko" });
  });

  it("turns what people type into a name", () => {
    expect(slugify("Salong Eko!")).toBe("salong-eko");
    expect(slugify("Hårsalongen Åsa & Co")).toBe("harsalongen-asa-co");
    expect(slugify("--x--")).toBe("x");
  });
});

describe("host resolution", () => {
  it("serves local and preview hosts as the app", () => {
    for (const host of [null, "", "localhost:3000", "127.0.0.1", "flerdo-demo-abc.vercel.app"]) {
      expect(resolveHost(host, directory, product)).toEqual({ kind: "app" });
    }
  });

  it("knows the platform's two sites", () => {
    for (const host of ["cresavo.com", "www.cresavo.com", "WWW.Cresavo.com:443", "cresavo.com."]) {
      expect(resolveHost(host, directory, "cresavo.com")).toEqual({ kind: "site", site: "apex" });
    }
    expect(resolveHost("demo.cresavo.com", directory, "cresavo.com")).toEqual({ kind: "site", site: "demo" });
    expect(resolveHost("salong-eko.cresavo.com", directory, "cresavo.com")).toEqual({ kind: "business", slug: "salong-eko", via: "subdomain" });
  });

  it("never hands a platform label to a business", () => {
    for (const label of ["demo", "www", "app", "api", "mail", "inbox", "admin", "studio", "status", "help", "docs", "login", "billing", "support"]) {
      expect(checkSlug(label), label).toEqual({ ok: false, problem: "reserved" });
      if (label !== "demo" && label !== "www") expect(resolveHost(`${label}.cresavo.com`, directory, "cresavo.com"), label).toEqual({ kind: "unknown", reason: "reserved" });
    }
  });

  it("shows coming soon on the product domain and the demo landing on its demo host", () => {
    const route = (host: string, path: string, legacyHome = false) => routeHost(host, path, directory, "cresavo.com", legacyHome);
    expect(route("cresavo.com", "/")).toEqual({ action: "rewrite", path: COMING_SOON_PATH });
    expect(route("www.cresavo.com", "/")).toEqual({ action: "rewrite", path: COMING_SOON_PATH });
    expect(route("demo.cresavo.com", "/")).toEqual({ action: "rewrite", path: LANDING_PATH });
    for (const path of ["/studio", "/boka/salong-eko", "/coming-soon", "/landing", "/_next/static/x.js"]) {
      expect(route("demo.cresavo.com", path)).toEqual({ action: "next" });
      expect(route("cresavo.com", path)).toEqual({ action: "next" });
    }
    expect(route("salong-eko.cresavo.com", "/")).toEqual({ action: "rewrite", path: "/boka/salong-eko" });
    expect(route("salong-eko.cresavo.com", "/coming-soon")).toEqual({ action: "rewrite", path: UNKNOWN_PATH });
    expect(route("app.cresavo.com", "/")).toEqual({ action: "rewrite", path: UNKNOWN_PATH });
  });

  it("previews the demo landing at / locally and on preview deployments, unless the legacy home is asked for", () => {
    for (const host of ["localhost:3000", "127.0.0.1:3000", "cresavo-abc.vercel.app"]) {
      expect(routeHost(host, "/", directory, "cresavo.com")).toEqual({ action: "rewrite", path: LANDING_PATH });
      expect(routeHost(host, "/coming-soon", directory, "cresavo.com")).toEqual({ action: "next" });
      expect(routeHost(host, "/", directory, "cresavo.com", true)).toEqual({ action: "next" });
    }
    expect(routeHost("demo.cresavo.com", "/", directory, "cresavo.com", true)).toEqual({ action: "rewrite", path: LANDING_PATH });
    expect(routeHost("cresavo.com", "/", directory, "cresavo.com", true)).toEqual({ action: "rewrite", path: COMING_SOON_PATH });
  });

  it("links the two sites absolutely on the real hosts and by path elsewhere", () => {
    const real = { apex: "https://cresavo.com/", demo: "https://demo.cresavo.com/" };
    for (const host of ["cresavo.com", "www.cresavo.com", "demo.cresavo.com"]) expect(siteLinks(host, "cresavo.com")).toEqual(real);
    for (const host of ["localhost:3000", "cresavo-abc.vercel.app", null]) expect(siteLinks(host, "cresavo.com")).toEqual({ apex: COMING_SOON_PATH, demo: "/" });
  });

  it("resolves a picked subdomain to its business", () => {
    expect(resolveHost(`kajsa.${product}`, directory, product)).toEqual({ kind: "business", slug: "kajsa", via: "subdomain" });
    expect(resolveHost(`KAJSA.${product}:443`, directory, product)).toEqual({ kind: "business", slug: "kajsa", via: "subdomain" });
    expect(resolveHost(`eko.localhost:3000`, directory, "localhost")).toEqual({ kind: "business", slug: "eko", via: "subdomain" });
  });

  it("resolves a connected own domain", () => {
    expect(resolveHost("boka.salongeko.se", directory, product)).toEqual({ kind: "business", slug: "salong-eko", via: "domain" });
    expect(resolveHost("Boka.SalongEko.se.", directory, product)).toEqual({ kind: "business", slug: "salong-eko", via: "domain" });
  });

  it("does not guess for everything else", () => {
    expect(resolveHost(`api.${product}`, directory, product)).toEqual({ kind: "unknown", reason: "reserved" });
    expect(resolveHost(`a.b.${product}`, directory, product)).toEqual({ kind: "unknown", reason: "invalid" });
    expect(resolveHost(`-x.${product}`, directory, product)).toEqual({ kind: "unknown", reason: "invalid" });
    expect(resolveHost("boka.other.se", directory, product)).toEqual({ kind: "unknown", reason: "not-connected" });
    expect(resolveHost(`evil${product}`, directory, product)).toEqual({ kind: "unknown", reason: "not-connected" });
  });

  it("normalises the host header", () => {
    expect(normalizeHost(" Boka.Example.COM:8080 ")).toBe("boka.example.com");
  });

  it("routes a business address to its booking page and keeps the studio off it", () => {
    const route = (path: string, host = `kajsa.${product}`) => routeHost(host, path, directory, product);
    expect(route("/")).toEqual({ action: "rewrite", path: "/boka/kajsa" });
    expect(route("/me")).toEqual({ action: "rewrite", path: "/boka/kajsa/me" });
    expect(route("/booking/b-12")).toEqual({ action: "rewrite", path: "/boka/kajsa/booking/b-12" });
    expect(route("/gift")).toEqual({ action: "rewrite", path: "/boka/kajsa/gift" });
    expect(route("/boka/kajsa/me")).toEqual({ action: "next" });
    expect(route("/_next/static/x.js")).toEqual({ action: "next" });
    expect(route("/demo/salon.webp")).toEqual({ action: "next" });
    expect(route("/tenant/icon.svg")).toEqual({ action: "next" });
    for (const path of ["/studio", "/admin", "/api/v1/bookings", "/api/concept/ai", "/landing"]) expect(route(path)).toEqual({ action: "rewrite", path: UNKNOWN_PATH });
    expect(route("/", "boka.salongeko.se")).toEqual({ action: "rewrite", path: "/boka/salong-eko" });
  });

  it("serves only the business's own /boka paths on its address", () => {
    const route = (path: string, host = `kajsa.${product}`) => routeHost(host, path, directory, product);
    expect(route("/boka/kajsa")).toEqual({ action: "next" });
    expect(route("/boka/kajsa/widget")).toEqual({ action: "next" });
    for (const path of ["/boka/salong-eko", "/boka/salong-eko/me", "/boka/kajsa-x", "/boka/"]) expect(route(path), path).toEqual({ action: "rewrite", path: UNKNOWN_PATH });
    expect(route("/boka/salong-eko", "boka.salongeko.se")).toEqual({ action: "next" });
    expect(route("/boka/kajsa", "boka.salongeko.se")).toEqual({ action: "rewrite", path: UNKNOWN_PATH });
    // The product's own hosts still serve every booking page by path.
    expect(routeHost("localhost:3000", "/boka/salong-eko", directory, product)).toEqual({ action: "next" });
  });

  it("points the demo-only owner link at the demo site from a business's address", () => {
    expect(ownerViewHref("localhost:3000", "http:", "cresavo.com")).toBe("/studio");
    expect(ownerViewHref("demo.cresavo.com", "https:", "cresavo.com")).toBe("/studio");
    expect(ownerViewHref("cresavo-abc.vercel.app", "https:", "cresavo.com")).toBe("/studio");
    expect(ownerViewHref("salong-eko.cresavo.com", "https:", "cresavo.com")).toBe("https://demo.cresavo.com/studio");
    expect(ownerViewHref("boka.salongeko.se", "http:", "cresavo.com")).toBe("https://demo.cresavo.com/studio");
    expect(ownerViewHref("salong-eko.localhost:3017", "http:", "localhost")).toBe("http://demo.localhost:3017/studio");
  });

  it("gives unknown hosts the friendly page and leaves the product host alone", () => {
    expect(routeHost("nobody.example.org", "/", directory, product)).toEqual({ action: "rewrite", path: UNKNOWN_PATH });
    expect(routeHost("nobody.example.org", "/_next/static/x.js", directory, product)).toEqual({ action: "next" });
    expect(routeHost("localhost:3000", "/studio", directory, product)).toEqual({ action: "next" });
  });

  it("shows the subdomain as it will be served", () => {
    expect(subdomainHost("kajsa", product)).toBe("kajsa.book.example");
  });
});

describe("own domain model", () => {
  it("cleans and checks what the owner types", () => {
    expect(checkDomain("https://Boka.SalongEko.se/", product)).toEqual({ ok: true, host: "boka.salongeko.se" });
    expect(checkDomain("boka.salongeko.se.", product)).toEqual({ ok: true, host: "boka.salongeko.se" });
    expect(checkDomain("", product)).toEqual({ ok: false, problem: "empty" });
    expect(checkDomain("salongeko.se", product)).toEqual({ ok: false, problem: "apex" });
    expect(checkDomain("boka", product)).toEqual({ ok: false, problem: "format" });
    expect(checkDomain("boka.salongeko.s", product)).toEqual({ ok: false, problem: "format" });
    expect(checkDomain("bo ka.salongeko.se", product)).toEqual({ ok: false, problem: "format" });
    expect(checkDomain("-boka.salongeko.se", product)).toEqual({ ok: false, problem: "format" });
    expect(checkDomain("10.0.0.1", product)).toEqual({ ok: false, problem: "address" });
    expect(checkDomain(`x.${product}`, product)).toEqual({ ok: false, problem: "product" });
  });

  it("gives the exact CNAME record", () => {
    expect(dnsInstruction("boka.salongeko.se")).toEqual({ type: "CNAME", name: "boka", host: "boka.salongeko.se", value: CNAME_TARGET });
    expect(CNAME_TARGET).toBe("cname.vercel-dns.com");
  });

  it("moves through waiting, verifying and secure, and stays secure", () => {
    expect(DOMAIN_STEPS).toEqual(["waiting-dns", "verifying", "secure"]);
    expect(advanceStatus("waiting-dns")).toBe("verifying");
    expect(advanceStatus("verifying")).toBe("secure");
    expect(advanceStatus("secure")).toBe("secure");
  });
});
