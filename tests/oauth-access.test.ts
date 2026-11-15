import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { resign } from "./helpers/oauth-sign";
import { accessToken, origin } from "./helpers/oauth";
import { verifyLabAccessToken } from "../src/lib/agent-api/oauth/server";
import { authenticateAgent } from "../src/lib/agent-api/keys";
import { agentErrorResponse } from "../src/lib/agent-api/v1";

beforeEach(() => {
  vi.stubEnv("BOOKING_PUBLIC_ORIGIN", origin); vi.stubEnv("BOOKING_OAUTH_LAB", "1");
  vi.stubEnv("BOOKING_RUNTIME", "local"); vi.stubEnv("BOOKING_ADDRESS_SECRET", "synthetic-oauth-socket-proof");
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

it("validates an issued token", async () => {
  expect(verifyLabAccessToken(await accessToken(), new Date())?.scopes).toContain("services:read");
});
it.each([{aud:"wrong"},{iss:"wrong"},{exp:0},{exp:undefined},{exp:"9999999999"},{scope:"admin"},{sub:"other"},{client_id:"unknown",sub:"unknown"},{iat:9999999999}])("rejects signed invalid claims %j", async claims => {
  expect(verifyLabAccessToken(resign(await accessToken(), claims),new Date())).toBeNull();
});
it.each([{alg:"HS256"},{typ:"JWT"},{kid:"unknown"},{crit:["unknown"]}])("rejects headers %j", async head => {
  expect(verifyLabAccessToken(resign(await accessToken(), {}, head),new Date())).toBeNull();
});
it("rejects tampering, foreign signing key and disabled lab", async () => {
  const token = await accessToken();
  expect(verifyLabAccessToken(`${token.slice(0,-8)}AAAAAAAA`, new Date())).toBeNull();
  expect(verifyLabAccessToken(resign(token, {}, {}, true), new Date())).toBeNull();
  vi.stubEnv("BOOKING_OAUTH_LAB", "0"); expect(verifyLabAccessToken(token,new Date())).toBeNull();
});
it("keeps challenges absolute and JSON errors unchanged", async () => {
  for (const code of ["unauthorized", "forbidden_scope"] as const) {
    const r = agentErrorResponse(code);
    expect(r.status).toBe(code === "unauthorized" ? 401 : 403);
    expect(r.headers.get("www-authenticate")).toContain(`resource_metadata="${origin}/.well-known/oauth-protected-resource"`);
    if(code === "forbidden_scope") expect(r.headers.get("www-authenticate")).toContain('error="insufficient_scope"');
    expect((await r.json()).error.code).toBe(code);
  }
});
it("rejects conflicting credentials and wrong scopes before database access", async () => {
  const token = await accessToken("services:read");
  const db = {} as Parameters<typeof authenticateAgent>[1];
  await expect(authenticateAgent(new Headers({authorization:`Bearer ${token}`,"x-api-key":"blk_other"}), db,"services:read")).rejects.toMatchObject({code:"unauthorized"});
  await expect(authenticateAgent(new Headers({authorization:`Bearer ${token}`}),db,"bookings:write")).rejects.toMatchObject({code:"forbidden_scope"});
});
