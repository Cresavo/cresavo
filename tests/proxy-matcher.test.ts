import { expect, it } from "vitest";
import { NextRequest } from "next/server";
import { config, OWNER_ACTIONS_MAX_BODY_BYTES, proxy } from "../src/proxy";

// Next.js anchors a matcher source to the whole path, so the test does the same.
const runsProxy = (path: string) => config.matcher.some((source) => new RegExp(`^${source}$`).test(path));

it("runs the proxy for pages and routes but not for static files", () => {
  for (const path of ["/", "/studio", "/boka/salong-eko", "/boka/salong-eko/widget", "/api/concept/ai/reply-customer",
    "/oauth/authorize", "/robots.txt", "/sitemap.xml", "/llms.txt", "/manifest.webmanifest", "/sandbox", "/.well-known/usp",
    "/api/concept/a2a/agent-card.json"]) expect(runsProxy(path), path).toBe(true);
  for (const path of ["/_next/static/chunks/app.js", "/_next/image", "/favicon.ico", "/site/hero.webp", "/media/tour.mp4",
    "/fonts/inter.woff2", "/brand/logo.svg", "/team/anna.jpg"]) expect(runsProxy(path), path).toBe(false);
});

const post = (path: string, length?: number) => proxy(new NextRequest(`https://cresavo.example${path}`, {
  method: "POST", headers: length === undefined ? {} : { "content-length": String(length) }, body: "{}",
}));

it("refuses an owner action body that declares more than the route reads, before Next.js buffers it", async () => {
  const refused = post("/api/owner/salon/actions", OWNER_ACTIONS_MAX_BODY_BYTES + 1);
  expect(refused.status).toBe(413);
  expect(await refused.json()).toEqual({ error: "too_large" });
  expect(post("/api/owner/salon/actions/", OWNER_ACTIONS_MAX_BODY_BYTES + 1).status).toBe(413);
  expect(post("/api/owner/salon/actions", OWNER_ACTIONS_MAX_BODY_BYTES).status).not.toBe(413);
  expect(post("/api/owner/salon/actions").status).not.toBe(413);
  // Other routes keep their own caps.
  expect(post("/api/concept/poster", OWNER_ACTIONS_MAX_BODY_BYTES + 1).status).not.toBe(413);
});
