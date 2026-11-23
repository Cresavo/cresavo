import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as signup } from "@/app/api/owner/signup/route";
import { POST as login } from "@/app/api/owner/login/route";
import { GET as me } from "@/app/api/owner/me/route";
import { POST as secondStep } from "@/app/api/owner/login/mfa/route";
import { POST as mfaSetup } from "@/app/api/owner/mfa/setup/route";
import { POST as mfaEnable } from "@/app/api/owner/mfa/enable/route";
import { POST as mfaDisable } from "@/app/api/owner/mfa/disable/route";
import { POST as mfaCodes } from "@/app/api/owner/mfa/recovery-codes/route";

const MFA_ROUTES = [
  ["/api/owner/login/mfa", secondStep], ["/api/owner/mfa/setup", mfaSetup], ["/api/owner/mfa/enable", mfaEnable],
  ["/api/owner/mfa/disable", mfaDisable], ["/api/owner/mfa/recovery-codes", mfaCodes],
] as const;

// Route guards that answer before any database work.

const post = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost${path}`, { method: "POST", body: "{}", headers: { "content-type": "application/json", host: "localhost", ...headers } });

afterEach(() => vi.unstubAllEnvs());

describe("owner routes", () => {
  it("do not exist unless owner accounts are switched on", async () => {
    vi.stubEnv("OWNER_ACCOUNTS_ENABLED", "");
    expect((await signup(post("/api/owner/signup", { origin: "http://localhost" }))).status).toBe(404);
    expect((await login(post("/api/owner/login", { origin: "http://localhost" }))).status).toBe(404);
    expect((await me(new NextRequest("http://localhost/api/owner/me"))).status).toBe(404);
    for (const [path, route] of MFA_ROUTES) expect((await route(post(path, { origin: "http://localhost" }))).status, path).toBe(404);
  });

  it("refuse writes from another site", async () => {
    vi.stubEnv("OWNER_ACCOUNTS_ENABLED", "1");
    const crossSite = { origin: "https://elsewhere.example", "sec-fetch-site": "cross-site" };
    const signupResponse = await signup(post("/api/owner/signup", crossSite));
    expect(signupResponse.status).toBe(403);
    expect(await signupResponse.json()).toEqual({ error: "forbidden_origin" });
    expect((await login(post("/api/owner/login", crossSite))).status).toBe(403);
    expect((await signup(post("/api/owner/signup"))).status).toBe(403);
    for (const [path, route] of MFA_ROUTES) expect(await (await route(post(path, crossSite))).json(), path).toEqual({ error: "forbidden_origin" });
  });
});
