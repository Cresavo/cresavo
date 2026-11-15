import { createHash, createHmac } from "node:crypto";
import { oauth } from "../../src/lib/agent-api/oauth/server";
export const origin = "http://127.0.0.1:3229";
export function labRequest(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-booking-client-ip", "127.0.0.1");
  headers.set("x-booking-client-proof", createHmac("sha256", "synthetic-oauth-socket-proof").update("127.0.0.1").digest("hex"));
  return new Request(input, { ...init, headers });
}
export async function accessToken(scope = "services:read bookings:read bookings:write") {
  const redirect_uri = "http://127.0.0.1:3339/callback", resource = `${origin}/api/v1/mcp`;
  const verifier = "v".repeat(43);
  const registered = await oauth(labRequest(`${origin}/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ redirect_uris: [redirect_uri], scope }) }), "register");
  if (registered.status !== 201) throw new Error("SYNTHETIC_REGISTRATION_FAILED");
  const { client_id } = await registered.json();
  const authorized = await oauth(labRequest(`${origin}/authorize?${new URLSearchParams({client_id, redirect_uri, resource, response_type:"code", code_challenge_method:"S256", code_challenge:createHash("sha256").update(verifier).digest("base64url")})}`), "authorize");
  const code = new URL(authorized.headers.get("location")!).searchParams.get("code")!;
  const response = await oauth(labRequest(`${origin}/token`, { method:"POST", headers:{"content-type":"application/x-www-form-urlencoded"}, body:new URLSearchParams({client_id, redirect_uri, resource, code, code_verifier:verifier, grant_type:"authorization_code"}) }), "token");
  if (response.status !== 200) throw new Error("SYNTHETIC_TOKEN_FAILED");
  return (await response.json()).access_token as string;
}
export async function rpcBody(response: Response) {
  const text = await response.text();
  if (response.headers.get("content-type")?.includes("text/event-stream")) {
    const data = text.split("\n").filter(line => line.startsWith("data:")).map(line => JSON.parse(line.slice(5)));
    return data.find(message => message.id === 1);
  }
  return JSON.parse(text);
}
