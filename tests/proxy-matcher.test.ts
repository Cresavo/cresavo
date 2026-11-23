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

// The self-hosted entry point refuses the same bodies before Next.js buffers them (it clones a body before it calls the proxy).
it("refuses an oversized or unbounded owner action body at the HTTP entry point", async () => {
  const { ownerActionRefusal, OWNER_ACTIONS_MAX_BODY_BYTES: cap } = await import("../scripts/owner-body-limit.mjs");
  expect(cap).toBe(OWNER_ACTIONS_MAX_BODY_BYTES);
  expect(ownerActionRefusal("POST", "/api/owner/salon/actions", { "content-length": String(cap + 1) })).toBe(413);
  expect(ownerActionRefusal("POST", "/api/owner/salon/actions/?x=1", { "content-length": String(cap + 1) })).toBe(413);
  expect(ownerActionRefusal("POST", "/api/owner/salon/actions", { "transfer-encoding": "chunked" })).toBe(411);
  expect(ownerActionRefusal("POST", "/api/owner/salon/actions", { "content-length": String(cap) })).toBe(0);
  expect(ownerActionRefusal("POST", "/api/concept/poster", { "content-length": String(cap + 1) })).toBe(0);
  expect(ownerActionRefusal("GET", "/api/owner/salon/actions", {})).toBe(0);
});

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

it("refuses a photo upload that declares more than one picture may be, at the entry point and in the proxy", async () => {
  const { ownerActionRefusal, OWNER_MEDIA_MAX_BODY_BYTES: cap } = await import("../scripts/owner-body-limit.mjs");
  const { MAX_MEDIA_BYTES } = await import("../src/lib/media/limits");
  expect(cap).toBe(MAX_MEDIA_BYTES);
  expect(ownerActionRefusal("POST", "/api/owner/media?kind=logo", { "content-length": String(cap + 1) })).toBe(413);
  expect(ownerActionRefusal("POST", "/api/owner/media", { "transfer-encoding": "chunked" })).toBe(411);
  expect(ownerActionRefusal("POST", "/api/owner/media", { "content-length": String(cap) })).toBe(0);
  expect(ownerActionRefusal("GET", "/api/owner/media", {})).toBe(0);
  expect(post("/api/owner/media", cap + 1).status).toBe(413);
  expect(post("/api/owner/media/", cap + 1).status).toBe(413);
  expect(post("/api/owner/media", cap).status).not.toBe(413);
  expect(post("/api/owner/salon/actions", cap).status).toBe(413);
});
