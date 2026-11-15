import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, createHmac, verify } from "node:crypto";
import { GET as resourceMetadata } from "../src/app/.well-known/oauth-protected-resource/route";
import { GET as serverMetadata } from "../src/app/.well-known/oauth-authorization-server/route";
import { POST as register } from "../src/app/register/route";
import { GET as authorize } from "../src/app/authorize/route";
import { POST as token } from "../src/app/token/route";
const origin = "http://127.0.0.1:3229";
const resource = `${origin}/api/v1/mcp`;
const redirect_uri = "http://127.0.0.1:3339/callback";
const invalidAuthorizations: Record<string,string>[] = [{redirect_uri:"https://evil.example.test"},{resource:"https://evil.example.test"},{client_id:"unknown"},{scope:"admin"},{scope:"availability:read"}];
const verifier = "v".repeat(43);
const challenge = createHash("sha256").update(verifier).digest("base64url");
export function labRequest(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-booking-client-ip", "127.0.0.1");
  headers.set("x-booking-client-proof", createHmac("sha256", "synthetic-oauth-socket-proof").update("127.0.0.1").digest("hex"));
  return new Request(input, { ...init, headers });
}
const form = (p: Record<string,string>) => labRequest(`${origin}/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(p) });
async function client() {
  const r = await register(labRequest(`${origin}/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ redirect_uris: [redirect_uri], scope: "services:read bookings:write" }) }));
  expect(r.status).toBe(201); return (await r.json()).client_id as string;
}
const auth = (id: string, overrides: Record<string,string> = {}) => authorize(labRequest(`${origin}/authorize?${new URLSearchParams({client_id:id, redirect_uri, resource, response_type:"code", code_challenge:challenge, code_challenge_method:"S256", state:"synthetic-state", ...overrides})}`));
async function code(id: string) { const r = await auth(id); expect(r.status).toBe(302); const url = new URL(r.headers.get("location")!); expect(url.searchParams.get("state")).toBe("synthetic-state"); return url.searchParams.get("code")!; }
const redeem = (id:string, c:string, changes:Record<string,string>={}) => token(form({client_id:id, code:c, redirect_uri, resource, grant_type:"authorization_code", code_verifier:verifier,...changes}));
beforeEach(() => { vi.stubEnv("BOOKING_PUBLIC_ORIGIN", origin); vi.stubEnv("BOOKING_OAUTH_LAB", "1"); vi.stubEnv("BOOKING_RUNTIME", "local"); vi.stubEnv("BOOKING_ADDRESS_SECRET", "synthetic-oauth-socket-proof"); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe("OAuth package 1", () => {
  it("publishes resource and S256 code-only AS metadata from operator origin", async () => {
    vi.stubEnv("BOOKING_PUBLIC_ORIGIN", "https://operator.example.test");
    expect(await (resourceMetadata as (r: Request) => Response)(new Request("http://evil.example.test", {headers:{host:"evil.example.test","x-forwarded-host":"evil.example.test"}})).json()).toMatchObject({resource:"https://operator.example.test/api/v1/mcp", authorization_servers:["https://operator.example.test"]});
    expect(await serverMetadata().json()).toMatchObject({issuer:"https://operator.example.test", code_challenge_methods_supported:["S256"], grant_types_supported:["authorization_code"], response_types_supported:["code"], token_endpoint_auth_methods_supported:["none"]});
  });
  it("uses loopback fallback and fails closed for invalid origins", () => {
    vi.stubEnv("BOOKING_PUBLIC_ORIGIN", undefined); vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("PORT", "3229");
    expect(resourceMetadata().status).toBe(200);
    vi.stubEnv("BOOKING_PUBLIC_ORIGIN", "http://evil.example.test"); expect(serverMetadata().status).toBe(503);
  });
  it("registers a public client without a secret", async () => { expect(await client()).toMatch(/^[\w-]{43}$/); });
  it.each(["", "plain"])("rejects missing PKCE or method %s", async method => { expect((await auth(await client(), {code_challenge_method:method, ...(method ? {} : {code_challenge:""})})).status).toBe(400); });
  it.each(invalidAuthorizations)("rejects invalid authorization %j", async changes => { expect((await auth(await client(), changes)).status).toBe(400); });
  it.each(["", "x".repeat(43)])("rejects missing/wrong verifier %s", async value => { const id=await client(); expect((await redeem(id,await code(id),{code_verifier:value})).status).toBe(400); });
  it("issues a signed audience/scope-bound token and consumes code atomically", async () => {
    const id=await client(), c=await code(id);
    const results=await Promise.all([redeem(id,c),redeem(id,c)]);
    expect(results.map(r=>r.status).sort()).toEqual([200,400]);
    const result=await results.find(r=>r.status===200)!.json();
    expect(result).toMatchObject({token_type:"Bearer",scope:"services:read bookings:write",expires_in:300});
    const [h,p,s]=result.access_token.split(".");
    expect(JSON.parse(Buffer.from(p,"base64url").toString())).toMatchObject({aud:resource,iss:origin,sub:id,scope:result.scope});
    const state=(globalThis as typeof globalThis & {bookingOAuthLab:{key:{publicKey:import("node:crypto").KeyObject}}}).bookingOAuthLab;
    expect(verify(null,Buffer.from(`${h}.${p}`),state.key.publicKey,Buffer.from(s,"base64url"))).toBe(true);
  });
  it("rejects expired codes", async () => { const id=await client(),c=await code(id); vi.useFakeTimers(); vi.setSystemTime(Date.now()+61000); expect((await redeem(id,c)).status).toBe(400); });
  it("rejects wrong client/resource/redirect during exchange", async () => {
    const id=await client(),c=await code(id),other=await client();
    const invalidExchanges: Record<string,string>[] = [{client_id:other},{resource:origin},{redirect_uri:origin}];
    for(const changes of invalidExchanges) expect((await redeem(id,c,changes)).status).toBe(400);
  });
  it("requires explicit lab opt-in, loopback origin and guarded test DB", async () => {
    vi.stubEnv("BOOKING_OAUTH_LAB", "0"); expect((await auth("unknown")).status).toBe(503);
    vi.stubEnv("BOOKING_OAUTH_LAB", "1"); vi.stubEnv("DATABASE_URL", "postgresql://synthetic@127.0.0.1/production"); expect((await auth("unknown")).status).toBe(503);
    vi.stubEnv("BOOKING_PUBLIC_ORIGIN", "https://operator.example.test"); expect((await auth("unknown")).status).toBe(503);
  });
  it("rejects unverified caller headers even with a forged loopback Host", async () => {
    const r = await authorize(new Request(`${origin}/authorize`, { headers: {host:"127.0.0.1", "x-booking-client-ip":"127.0.0.1", "x-forwarded-for":"127.0.0.1"} }));
    expect(r.status).toBe(503);
  });
  it("logs only fixed route/status fields, never credentials", async () => {
    const log=vi.spyOn(console,"info").mockImplementation(()=>{}); const id=await client(),c=await code(id); const r=await redeem(id,c); const t=(await r.json()).access_token;
    for(const call of log.mock.calls) expect(Object.keys(JSON.parse(call[0]))).toEqual(["event","route","status"]);
    const output=JSON.stringify(log.mock.calls); for(const secret of [id,c,t,verifier,challenge,"PRIVATE KEY"]) expect(output).not.toContain(secret);
  });
});
