import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import type { bookingView, itemView, proposalView } from "../../src/concept/pairing/appointments";

import { base } from "./server";
export { base };
export const resource = base + "/mcp/owner";

export type Tokens = { access_token: string; refresh_token: string };
export type Booking = ReturnType<typeof bookingView>;
export type Proposal = ReturnType<typeof proposalView>;
export type Item = ReturnType<typeof itemView>;

export async function jsonPost(path: string, data: unknown, cookie = "", origin = base) {
  return fetch(base + path, { method: "POST", headers: { Origin: origin, Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify(data) });
}
export function form(path: string, data: Record<string, string>, cookie = "", origin = base) {
  return fetch(base + path, { method: "POST", redirect: "manual", headers: { Cookie: cookie, Origin: origin }, body: new URLSearchParams(data) });
}
export async function connectRequest(callback = "https://assistant.example.test/callback") {
  const res = await jsonPost("/oauth/register", { client_name: "Studio test assistant", redirect_uris: [callback], token_endpoint_auth_method: "none" });
  if (res.status !== 201) throw new Error("Registration failed: " + res.status);
  const { client_id } = await res.json();
  const verifier = randomBytes(32).toString("base64url");
  const authorization = new URL(base + "/oauth/authorize");
  authorization.search = new URLSearchParams({ client_id, redirect_uri: callback, response_type: "code", resource,
    state: randomUUID(), code_challenge_method: "S256", code_challenge: createHash("sha256").update(verifier).digest("base64url") }).toString();
  return { client_id: client_id as string, authorization, redeem: (code: string, overrides = {}) =>
    form("/oauth/token", { client_id, code, redirect_uri: callback, grant_type: "authorization_code", resource, code_verifier: verifier, ...overrides }) };
}
export async function sdk(tokens: Tokens) {
  const client = new Client({ name: "pairing-test", version: "1" });
  await client.connect(new StreamableHTTPClientTransport(new URL(resource), { requestInit: { headers: { Authorization: "Bearer " + tokens.access_token } } }));
  return client;
}
export async function call<T>(client: Client, name: string, args: Record<string, unknown> = {}): Promise<T> {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) throw new Error(name + ": " + JSON.stringify(result.content));
  return result.structuredContent as T;
}
export async function moveArgs(client: Client) {
  const { items } = await call<{ items: Item[] }>(client, "list_inbox_items");
  const bookingId = items[0].bookingId!;
  const { slots } = await call<{ slots: { date: string; time: string }[] }>(client, "find_reschedule_options", { bookingId });
  return { bookingId, ...slots[0], idempotencyKey: randomUUID() };
}
