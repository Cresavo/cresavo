import { expect, it } from "vitest";
import { config } from "../src/proxy";

// Next.js anchors a matcher source to the whole path, so the test does the same.
const runsProxy = (path: string) => config.matcher.some((source) => new RegExp(`^${source}$`).test(path));

it("runs the proxy for pages and routes but not for static files", () => {
  for (const path of ["/", "/studio", "/boka/salong-eko", "/boka/salong-eko/widget", "/api/concept/ai/reply-customer",
    "/oauth/authorize", "/robots.txt", "/sitemap.xml", "/llms.txt", "/manifest.webmanifest", "/sandbox", "/.well-known/usp",
    "/api/concept/a2a/agent-card.json"]) expect(runsProxy(path), path).toBe(true);
  for (const path of ["/_next/static/chunks/app.js", "/_next/image", "/favicon.ico", "/site/hero.webp", "/media/tour.mp4",
    "/fonts/inter.woff2", "/brand/logo.svg", "/team/anna.jpg"]) expect(runsProxy(path), path).toBe(false);
});
