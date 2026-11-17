import { afterEach, describe, expect, it, vi } from "vitest";
import { connectDomain, disconnectDomain, domainStatus, domainsConfig, statusFrom } from "@/concept/server/vercel-domains";

const TOKEN = "tok_super_secret_value_123";
const env = { CONCEPT_DOMAINS_ENABLED: "1", VERCEL_API_TOKEN: TOKEN, VERCEL_PROJECT_ID: "prj_abc", VERCEL_TEAM_ID: "team_xyz" };

const reply = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function mockFetch(routes: Record<string, Response | (() => Response)>) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${new URL(String(url)).pathname}`;
    const hit = routes[key];
    if (!hit) throw new Error(`unexpected ${key}`);
    return typeof hit === "function" ? hit() : hit.clone();
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

afterEach(() => vi.restoreAllMocks());

describe("Vercel domains module", () => {
  it("is off unless the flag and all keys are set", () => {
    expect(domainsConfig({})).toBeNull();
    expect(domainsConfig({ ...env, CONCEPT_DOMAINS_ENABLED: undefined })).toBeNull();
    expect(domainsConfig({ ...env, CONCEPT_DOMAINS_ENABLED: "0" })).toBeNull();
    expect(domainsConfig({ ...env, VERCEL_API_TOKEN: "" })).toBeNull();
    expect(domainsConfig({ ...env, VERCEL_PROJECT_ID: undefined })).toBeNull();
    expect(domainsConfig(env)).toEqual({ token: TOKEN, projectId: "prj_abc", teamId: "team_xyz" });
    expect(domainsConfig({ ...env, VERCEL_TEAM_ID: undefined })?.teamId).toBeUndefined();
  });

  it("never calls the network while disabled", async () => {
    const fetchSpy = vi.fn();
    expect(await connectDomain("boka.salongeko.se", {}, fetchSpy as unknown as typeof fetch)).toEqual({ ok: false, error: "disabled" });
    expect(await domainStatus("boka.salongeko.se", {}, fetchSpy as unknown as typeof fetch)).toEqual({ ok: false, error: "disabled" });
    expect(await disconnectDomain("boka.salongeko.se", {}, fetchSpy as unknown as typeof fetch)).toEqual({ ok: false, error: "disabled" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses a bad domain before calling Vercel", async () => {
    const fetchSpy = vi.fn();
    expect(await connectDomain("not a domain", env, fetchSpy as unknown as typeof fetch)).toEqual({ ok: false, error: "invalid" });
    expect(await connectDomain("salongeko.se", env, fetchSpy as unknown as typeof fetch)).toEqual({ ok: false, error: "invalid" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("adds the domain, then reads its status, with the token only in the header", async () => {
    const fetchMock = mockFetch({
      "POST /v10/projects/prj_abc/domains": reply(200, { name: "boka.salongeko.se" }),
      "GET /v9/projects/prj_abc/domains/boka.salongeko.se": reply(200, { verified: false }),
      "GET /v6/domains/boka.salongeko.se/config": reply(200, { misconfigured: true }),
    });
    expect(await connectDomain("https://Boka.SalongEko.se/", env, fetchMock)).toEqual({ ok: true, status: "waiting-dns" });
    const calls = (fetchMock as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls;
    expect(calls).toHaveLength(3);
    expect(JSON.parse(calls[0][1].body as string)).toEqual({ name: "boka.salongeko.se" });
    for (const [url, init] of calls) {
      expect(url).toContain("teamId=team_xyz");
      expect(url).not.toContain(TOKEN);
      expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
      expect(String(init.body ?? "")).not.toContain(TOKEN);
    }
  });

  it("maps verified and misconfigured to the three statuses", () => {
    expect(statusFrom({ verified: true }, { misconfigured: true })).toBe("waiting-dns");
    expect(statusFrom({ verified: false }, { misconfigured: false })).toBe("verifying");
    expect(statusFrom({ verified: true }, { misconfigured: false })).toBe("secure");
    expect(statusFrom({ verified: true }, {})).toBe("waiting-dns");
  });

  it("reports verifying and secure from the API", async () => {
    const config = (verified: boolean, misconfigured: boolean) =>
      mockFetch({
        "GET /v9/projects/prj_abc/domains/boka.salongeko.se": reply(200, { verified }),
        "GET /v6/domains/boka.salongeko.se/config": reply(200, { misconfigured }),
      });
    expect(await domainStatus("boka.salongeko.se", env, config(false, false))).toEqual({ ok: true, status: "verifying" });
    expect(await domainStatus("boka.salongeko.se", env, config(true, false))).toEqual({ ok: true, status: "secure" });
  });

  it("treats a conflict as already added and carries on", async () => {
    const fetchMock = mockFetch({
      "POST /v10/projects/prj_abc/domains": reply(409, { error: { code: "domain_already_in_use" } }),
      "GET /v9/projects/prj_abc/domains/boka.salongeko.se": reply(200, { verified: true }),
      "GET /v6/domains/boka.salongeko.se/config": reply(200, { misconfigured: false }),
    });
    expect(await connectDomain("boka.salongeko.se", env, fetchMock)).toEqual({ ok: true, status: "secure" });
  });

  it("separates rejections from outages without leaking the token", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const info = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const results = [
      await connectDomain("boka.salongeko.se", env, mockFetch({ "POST /v10/projects/prj_abc/domains": reply(403, { error: { message: `bad token ${TOKEN}` } }) })),
      await connectDomain("boka.salongeko.se", env, mockFetch({ "POST /v10/projects/prj_abc/domains": reply(503) })),
      await connectDomain("boka.salongeko.se", env, (async () => { throw new Error(`socket closed for ${TOKEN}`); }) as unknown as typeof fetch),
      await domainStatus("boka.salongeko.se", env, mockFetch({ "GET /v9/projects/prj_abc/domains/boka.salongeko.se": reply(404) })),
    ];
    expect(results).toEqual([
      { ok: false, error: "rejected" },
      { ok: false, error: "unavailable" },
      { ok: false, error: "unavailable" },
      { ok: false, error: "rejected" },
    ]);
    expect(JSON.stringify(results)).not.toContain(TOKEN);
    for (const spy of [log, warn, info]) expect(JSON.stringify(spy.mock.calls)).not.toContain(TOKEN);
  });

  it("removes a domain", async () => {
    const fetchMock = mockFetch({ "DELETE /v9/projects/prj_abc/domains/boka.salongeko.se": reply(200, {}) });
    expect(await disconnectDomain("boka.salongeko.se", env, fetchMock)).toEqual({ ok: true, status: "waiting-dns" });
    expect(await disconnectDomain("boka.salongeko.se", env, mockFetch({ "DELETE /v9/projects/prj_abc/domains/boka.salongeko.se": reply(500) }))).toEqual({ ok: false, error: "unavailable" });
  });
});
