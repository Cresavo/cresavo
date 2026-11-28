import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { inboxDir } from "./inbox-lib.mjs";

const origin = process.env.BOOKING_PUBLIC_ORIGIN ?? "http://127.0.0.1:3217";
const base = new URL(origin);
if (!["127.0.0.1", "localhost", "[::1]"].includes(base.hostname) || !["http:", "https:"].includes(base.protocol) || base.origin !== origin) throw new Error("Loopback origin required");
const interactive = process.argv.includes("--interactive");
const customerEmail = (process.env.DEMO_CUSTOMER_EMAIL ?? "kund@example.test").trim().toLowerCase();
if (!/^[a-z0-9][a-z0-9._+-]{0,63}@example\.test$/.test(customerEmail)) throw new Error("DEMO_CUSTOMER_EMAIL must be a synthetic @example.test address");
if (!interactive) inboxDir();
const resource = `${origin}/api/v1/salons/demo/mcp`;
const redirect = "http://127.0.0.1:4555/callback";
const log = (step: string) => console.log(`✓ ${step}`);
const local = (iso: string) => new Date(iso).toLocaleString("sv-SE", { timeZone: "Europe/Stockholm", dateStyle: "medium", timeStyle: "short" });
async function request(url: string, init?: RequestInit) {
  if (new URL(url).origin !== origin) throw new Error("Non-local endpoint refused");
  const response = await fetch(url, { ...init, redirect: "manual" });
  if (!response.ok && response.status !== 302 && response.status !== 303) throw new Error(`HTTP ${response.status} at ${new URL(url).pathname}`);
  return response;
}
const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body) });
const form = (values: Record<string, string>): RequestInit => ({ method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", origin }, body: new URLSearchParams(values) });
let client: Client | undefined;
try {
  const metadata = await (await request(`${origin}/.well-known/oauth-protected-resource/api/v1/salons/demo/mcp`)).json();
  if (metadata.resource !== resource || metadata.authorization_servers?.[0] !== `${origin}/agent-oauth`) throw new Error("Unexpected resource metadata");
  const server = await (await request(`${origin}/.well-known/oauth-authorization-server/agent-oauth`)).json();
  if (server.issuer !== `${origin}/agent-oauth`) throw new Error("Unexpected issuer");
  log("OAuth discovery");
  const registration = await (await request(server.registration_endpoint, json({ client_name: "Cresavo agentic demo", redirect_uris: [redirect] }))).json();
  const verifier = randomBytes(32).toString("base64url"), challenge = createHash("sha256").update(verifier).digest("base64url");
  const query = new URLSearchParams({ response_type: "code", client_id: registration.client_id, redirect_uri: redirect, code_challenge: challenge, code_challenge_method: "S256", state: "demo", resource });
  const html = await (await request(`${server.authorization_endpoint}?${query}`)).text();
  const handle = /name="consent" value="([\w-]{43})"/.exec(html)?.[1];
  if (!handle) throw new Error("OAuth consent form missing");
  const allowed = await request(server.authorization_endpoint, form({ consent: handle, decision: "allow" }));
  const callback = new URL(allowed.headers.get("location") ?? "");
  if (callback.origin + callback.pathname !== redirect || callback.searchParams.get("state") !== "demo") throw new Error("Unexpected callback");
  const code = callback.searchParams.get("code"); if (!code) throw new Error("Authorization failed");
  const token = await (await request(server.token_endpoint, form({ grant_type: "authorization_code", client_id: registration.client_id, code, code_verifier: verifier, redirect_uri: redirect, resource }))).json();
  if (!token.access_token) throw new Error("Token exchange failed");
  log("Registered and authorized with PKCE (credentials masked)");
  client = new Client({ name: "cresavo-agentic-demo", version: "1" });
  await client.connect(new StreamableHTTPClientTransport(new URL(resource), { requestInit: { headers: { authorization: `Bearer ${token.access_token}` } } }));
  async function call(name: string, args: Record<string, unknown>) {
    const result = await client!.callTool({ name, arguments: args });
    if (result.isError) throw new Error(`${name} failed`);
    const content = result.content as { text?: string }[];
    return JSON.parse(content[0].text!);
  }
  const services = await call("list_services", { business: "demo" });
  const service = services.services[0]; if (!service) throw new Error("No services");
  log(`Discovered ${services.services.length} services: ${services.services.map((s: { name: string }) => s.name).join(", ")}`);
  let slot;
  for (let day = 1; day <= 14 && !slot; day++) {
    const date = new Date(Date.now() + day * 86400000).toISOString().slice(0, 10);
    const available = await call("get_availability", { business: "demo", service: service.id, date });
    slot = available.slots[0];
  }
  if (!slot) throw new Error("No available times in the next two weeks");
  log(`Found an available time for ${service.name}: ${local(slot.start)} (Stockholm time)`);
  const terms = { business: "demo", serviceId: service.id, serviceVersion: service.version, staffId: slot.staff.id, start: slot.start };
  const proposed = await call("create_proposal", terms);
  const id = proposed.proposal.id;
  if (proposed.consentUrl !== `${origin}/consent/${id}`) throw new Error("Unexpected consent URL");
  log(`Proposed ${proposed.proposal.serviceName} with ${proposed.proposal.staff.name}, ${proposed.proposal.price.amountMinor / 100} SEK; waiting for the customer`);
  let email: string;
  if (interactive) {
    email = customerEmail;
    console.log(`→ Open ${proposed.consentUrl} in the browser, type ${email}, get the code with \`npm run demo:agentic:inbox\` and approve.`);
    const until = Date.now() + 10 * 60000;
    for (;;) {
      const state = await call("get_proposal", { proposalId: id });
      if (state.proposal.status === "approved") break;
      if (state.proposal.status !== "pending" || Date.now() > until) throw new Error(`Proposal ${state.proposal.status}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    log("Customer approved on the consent page");
  } else {
    const decide = async (body: unknown) => (await request(`${origin}/consent/${id}/decision`, json(body))).json();
    const viewed = await decide({ decision: "view" });
    email = `demo-${randomUUID()}@example.test`;
    await decide({ decision: "send-code", email });
    const message = JSON.parse(readFileSync(join(inboxDir(), `${id}.json`), "utf8"));
    if (message.proposalId !== id || !/^\d{6}$/.test(message.code)) throw new Error("Inbox code missing");
    const approval = await decide({ decision: "yes", proposalHash: viewed.proposalHash, code: message.code });
    if (approval.status !== "approved") throw new Error("Consent failed");
    log("Customer approved with simulated email code (******)");
  }
  const proposal = await call("get_proposal", { proposalId: id });
  if (!proposal.proposal.mandateId) throw new Error("Mandate missing");
  const booked = await call("create_booking", { ...terms, mandateId: proposal.proposal.mandateId, confirmed: true, idempotencyKey: randomUUID(), customer: { name: "Demo Customer", email } });
  if (booked.booking.status !== "confirmed" || booked.notices?.confirmation?.status !== "simulated") throw new Error("Booking or simulated notices missing");
  const checked = await call("get_booking", { bookingId: booked.booking.id });
  if (checked.booking.status !== "confirmed" || checked.notices?.reminder?.status !== "scheduled-simulated") throw new Error("Booking verification failed");
  log(`Booking ${checked.booking.status}; confirmation e-mail simulated to ${checked.notices.confirmation.to}, reminder scheduled for ${local(checked.notices.reminder.at)} (Stockholm time)`);
  console.log("Demo flow passed.");
} catch (error) { console.error(`Demo failed: ${error instanceof Error ? error.message : "unknown error"}`); process.exitCode = 1; }
finally { await client?.close(); }
