import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { summariseRelease } from "../src/concept/site/github-releases";
import { updatedAgo } from "../src/concept/site/release-feed";

const notes = `# Cresavo 0.5.0 – simple by default

> Pre-release.

## New since 0.4.0

- **Your own salon in two minutes.** Name it, pick the type.
- **Simple by default.** New salons start with every add-on switched off.
- **Cancellation rules and deposits.** Set a window.
- **Clearer booking.** Customers see the total.
- **English and Swedish.** The studio follows your language.
- Many fixes.`;

const release = {
  tag_name: "v0.5.0",
  name: "Cresavo 0.5.0",
  html_url: "https://github.com/Cresavo/cresavo/releases/tag/v0.5.0",
  published_at: "2026-11-19T18:54:13Z",
  body: notes,
  draft: false,
};

it("reads the theme and the first four highlights from the release notes", () => {
  expect(summariseRelease(release)).toEqual({
    version: "0.5.0",
    title: "simple by default",
    url: release.html_url,
    publishedAt: release.published_at,
    highlights: ["Your own salon in two minutes", "Simple by default", "Cancellation rules and deposits", "Clearer booking"],
  });
});

it("falls back to the GitHub title and skips drafts or foreign links", () => {
  expect(summariseRelease({ ...release, body: "Small fixes." })).toMatchObject({ title: "Cresavo 0.5.0", highlights: [] });
  expect(summariseRelease({ ...release, name: "Cresavo 0.4.0 – open source", body: "Intro." })).toMatchObject({ title: "open source" });
  expect(summariseRelease({ ...release, draft: true })).toBeNull();
  expect(summariseRelease({ ...release, html_url: "https://example.com/x" })).toBeNull();
  expect(summariseRelease({ ...release, published_at: "soon" })).toBeNull();
});

it("says how long ago code was pushed in Stockholm calendar days", () => {
  const now = "2026-11-19T22:30:00Z";
  expect(updatedAgo("2026-11-19T08:00:00Z", now, "en")).toBe("today");
  expect(updatedAgo("2026-11-18T23:30:00Z", now, "en")).toBe("today");
  expect(updatedAgo("2026-11-18T22:59:00Z", now, "en")).toBe("yesterday");
  expect(updatedAgo("2026-11-18T12:00:00Z", now, "sv")).toBe("i går");
  expect(updatedAgo("2026-11-01T12:00:00Z", now, "en")).toBe("3 weeks ago");
});

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.resetModules();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

it("keeps the three newest published releases and hides the feed when GitHub fails", async () => {
  const { getReleases } = await import("../src/concept/site/github-releases");
  fetchMock.mockResolvedValueOnce(Response.json([
    { ...release, tag_name: "v0.6.0", draft: true },
    release,
    { ...release, tag_name: "v0.4.0" },
    { ...release, tag_name: "v0.3.0" },
    { ...release, tag_name: "v0.2.0" },
  ]));
  expect((await getReleases())?.map((r) => r.version)).toEqual(["0.5.0", "0.4.0", "0.3.0"]);
  expect(fetchMock).toHaveBeenCalledWith("https://api.github.com/repos/Cresavo/cresavo/releases?per_page=5", { signal: expect.any(AbortSignal) });

  vi.resetModules();
  const fresh = await import("../src/concept/site/github-releases");
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }));
  expect(await fresh.getReleases()).toBeNull();
});
