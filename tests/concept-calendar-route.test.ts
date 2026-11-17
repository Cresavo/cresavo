import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as feedRoute } from "@/app/api/concept/calendar/[staff]/route";
import { GET as linksRoute } from "@/app/api/concept/calendar/route";
import { feedToken } from "@/concept/server/feed-token";

const feed = (staff: string, token?: string) =>
  feedRoute(new Request(`http://localhost/api/concept/calendar/${staff}${token ? `?token=${token}` : ""}`), { params: Promise.resolve({ staff }) });

afterEach(() => vi.unstubAllEnvs());

describe("calendar feed route", () => {
  it("returns a calendar for the right token and says nothing otherwise", async () => {
    const token = feedToken("anna")!;
    const ok = await feed("anna.ics", token);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(await ok.text()).toMatch(/^BEGIN:VCALENDAR\r\n/);

    for (const response of [await feed("anna.ics"), await feed("anna.ics", "wrong"), await feed("anna.ics", feedToken("erik")!), await feed("anna", token), await feed("nobody.ics", feedToken("nobody")!)]) {
      expect(response.status).toBe(404);
    }
  });

  it("is switched off in production without CONCEPT_ICS_SECRET", async () => {
    const token = feedToken("anna")!;
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CONCEPT_ICS_SECRET", "");
    expect((await feed("anna.ics", token)).status).toBe(503);
  });

  it("works in production with a long enough secret", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CONCEPT_ICS_SECRET", "a-long-enough-secret");
    expect((await feed("anna.ics", feedToken("anna")!)).status).toBe(200);
  });

  it("lists the links only to the studio's own origin", async () => {
    const blocked = await linksRoute(new Request("http://localhost/api/concept/calendar", { headers: { "sec-fetch-site": "cross-site" } }), undefined);
    expect(blocked.status).toBe(403);
    const ok = await linksRoute(new Request("http://localhost/api/concept/calendar", { headers: { "sec-fetch-site": "same-origin" } }), undefined);
    const body = (await ok.json()) as { feeds: { staffId: string; path: string }[] };
    expect(body.feeds.map((f) => f.staffId)).toEqual(["anna", "erik"]);
    expect(body.feeds[0].path).toBe(`/api/concept/calendar/anna.ics?token=${feedToken("anna")}`);
  });

  it("lists no links while feeds are closed", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CONCEPT_ICS_SECRET", "");
    const ok = await linksRoute(new Request("http://localhost/api/concept/calendar", { headers: { "sec-fetch-site": "same-origin" } }), undefined);
    expect(await ok.json()).toEqual({ feeds: [] });
  });
});
