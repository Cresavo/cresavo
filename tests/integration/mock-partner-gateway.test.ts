import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { DateTime } from "luxon";
import { db } from "../../src/lib/db";
import { clearLabBookingProviders, getBookingProvider, registerLabBookingProvider } from "../../src/lib/agent-api/provider";
import { nativeBookingProvider } from "../../src/lib/agent-api/provider/native";
import { createMockPartnerProvider } from "../../src/lib/agent-api/provider/mock-partner";
import { startMockPartnerServer } from "../../src/lib/agent-api/provider/mock-partner-server";
import { authenticateAgent, createAgentApiKey, type AgentPrincipal } from "../../src/lib/agent-api/keys";
import { clearLabOAuthBusinesses, registerLabOAuthBusiness } from "../../src/lib/agent-api/oauth/lab-business";
import { verifyLabAccessToken } from "../../src/lib/agent-api/oauth/server";
import { customerDecision, createProposal, getProposal } from "../../src/lib/agent-api/proposals";
import { cancelBookingV1, createAgentBooking, getBookingV1, scopedIdempotencyKey } from "../../src/lib/agent-api/bookings";
import { servicesV1, availabilityV1, agentRoute, Created } from "../../src/lib/agent-api/v1";
import { issueSyntheticMandate } from "../../src/lib/agent-api/mandates";
import { readAudit } from "../../src/lib/agent-api/audit-read";
import { AGENT_API_CHANNEL } from "../../src/lib/domain";
import { POST as consent } from "../../src/app/consent/[id]/decision/route";
import { accessToken, labRequest, origin } from "../helpers/oauth";
import { chmodSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { CHANNEL_CUSTOMER } from "../../src/lib/agent-api/customer-channel-lab";

const clients: string[] = [];
const oauthAuditClients: string[] = [];
let server: Awaited<ReturnType<typeof startMockPartnerServer>> | undefined;
let provider: ReturnType<typeof createMockPartnerProvider>;
beforeEach(async () => {
  vi.stubEnv("BOOKING_CONSENT_LAB", "1"); vi.stubEnv("BOOKING_OAUTH_LAB", "1");
  vi.stubEnv("BOOKING_PUBLIC_ORIGIN", origin); vi.stubEnv("BOOKING_RUNTIME", "local");
  vi.stubEnv("BOOKING_ADDRESS_SECRET", "synthetic-oauth-socket-proof");
  server = await startMockPartnerServer({ port: 0 });
  provider = createMockPartnerProvider({ baseUrl: server.baseUrl });
  registerLabBookingProvider("lab-partner", provider);
});
afterEach(async () => {
  vi.restoreAllMocks(); clearLabBookingProviders(); clearLabOAuthBusinesses();
  await server?.close(); server = undefined; vi.unstubAllEnvs();
});
afterAll(async () => {
  const keys = await db.agentApiKey.findMany({ where: { clientId: { in: clients } } });
  await db.agentApiEvent.deleteMany({ where: { keyId: { in: keys.map(k => k.id) } } });
  // AgentAuditEvent is append-only (AGENT_AUDIT_APPEND_ONLY); do not delete it.
  await db.agentBooking.deleteMany({ where: { clientId: { in: clients } } });
  await db.partnerBookingAttempt.deleteMany({ where: { clientId: { in: clients } } });
  await db.agentProposal.deleteMany({ where: { clientId: { in: clients } } });
  await db.agentMandate.deleteMany({ where: { clientId: { in: clients } } });
  await db.agentApiKey.deleteMany({ where: { clientId: { in: clients } } });
  await db.agentClient.deleteMany({ where: { id: { in: clients } } });
  await db.$disconnect();
});
async function actor(oauth = false, scopes = ["services:read", "availability:read", "bookings:read", "bookings:write"]) {
  let key: string;
  if (oauth) {
    key = await accessToken(scopes.join(" "));
    const token = verifyLabAccessToken(key, new Date())!;
    registerLabOAuthBusiness(token.clientId, "lab-partner");
    oauthAuditClients.push(token.clientId);
  } else key = (await createAgentApiKey({ businessId: "lab-partner", agentName: "Synthetic partner client",
    ownerName: "Synthetic operator", ownerContact: "partner@example.test", scopes }, db)).key;
  const principal = await authenticateAgent(new Headers({ authorization: `Bearer ${key}` }), db, scopes[0] as "services:read");
  clients.push(principal.clientId); return { key, principal };
}
async function payload(p: AgentPrincipal, index = 0) {
  const catalog = await servicesV1(p, new URLSearchParams({ business: "lab-partner" }));
  const service = catalog.services[0];
  const date = DateTime.now().plus({ days: 30 }).toISODate()!;
  const available = await availabilityV1(p, new URLSearchParams({ business: "lab-partner", service: service.id, date }));
  const slot = available.slots[index];
  return { business: "lab-partner", serviceId: service.id, serviceVersion: service.version,
    staffId: slot.staff.id, start: slot.start };
}
type Payload = Awaited<ReturnType<typeof payload>>;
const body = (input: Payload, mandateId?: string) => ({ ...input, confirmed: true,
  customer: { name: "Synthetic customer", email: "partner-customer@example.test" }, ...(mandateId ? { mandateId } : {}) });
async function approved(p: AgentPrincipal, input: Payload) {
  const result = await createProposal(p, input);
  const token = new URL(result.approvalUrl!).hash.slice(1);
  const viewed = await customerDecision(result.proposal.id, { token, decision: "view" });
  await customerDecision(result.proposal.id, { token, decision: "yes", proposalHash: viewed.proposalHash });
  return { mandateId: (await getProposal(p, result.proposal.id)).proposal.mandateId!, proposalId: result.proposal.id, token };
}
function created(result: unknown) { return (result instanceof Created ? result.body : result) as { replayed: boolean; booking: { id: string; status: string } }; }

it("separate customer contact is checked before any partner write and on an identical retry", async () => {
  const root = realpathSync(tmpdir()), inbox = mkdtempSync(join(root, "booking-consent-inbox-"));
  chmodSync(inbox, 0o700);
  try {
    vi.stubEnv("BOOKING_CONSENT_DELIVERY", "separate-lab"); vi.stubEnv("BOOKING_CONSENT_INBOX_DIR", inbox);
    const { principal } = await actor(), input = await payload(principal);
    const p = await createProposal(principal, input);
    expect(p.approvalUrl).toBeUndefined();
    const token = new URL(JSON.parse(readFileSync(join(inbox, p.proposal.id + ".json"), "utf8")).approvalUrl).hash.slice(1);
    const viewed = await customerDecision(p.proposal.id, { token, decision: "view" });
    await customerDecision(p.proposal.id, { token, decision: "yes", proposalHash: viewed.proposalHash });
    const mandateId = (await getProposal(principal, p.proposal.id)).proposal.mandateId!;
    await expect(createAgentBooking(principal, "wrong-contact", body(input, mandateId))).rejects.toMatchObject({ code: "mandate_denied" });
    expect(server!.state.bookings.size).toBe(0);
    const data = { ...body(input, mandateId), customer: { name: CHANNEL_CUSTOMER.name, email: CHANNEL_CUSTOMER.email } };
    const first = created(await createAgentBooking(principal, "bound-contact", data));
    const replay = created(await createAgentBooking(principal, "bound-contact", data));
    expect(replay).toMatchObject({ replayed: true, booking: { id: first.booking.id } });
    expect(server!.state.bookings.size).toBe(1);
  } finally {
    if (!resolve(inbox).startsWith(root + sep + "booking-consent-inbox-")) throw new Error("OWN_INBOX_REQUIRED");
    rmSync(inbox, { recursive: true });
  }
});

it.each([false, true])("E2E key/OAuth: provider catalog, customer yes, create, get and cancel (%s)", async oauth => {
  const { principal, key } = await actor(oauth);
  expect(principal.businessId).toBe("lab-partner");
  expect(getBookingProvider("demo")).toBe(nativeBookingProvider);
  const input = await payload(principal);
  await expect(createAgentBooking(principal, "missing", body(input))).rejects.toMatchObject({ code: "mandate_required" });
  expect(server!.state.bookings.size).toBe(0);
  const pending = await createProposal(principal, input);
  const token = new URL(pending.approvalUrl!).hash.slice(1);
  const denied = await consent(labRequest(`${origin}/consent/${pending.proposal.id}/decision`, { method: "POST",
    headers: { origin, authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ token, decision: "yes" }) }), { params: Promise.resolve({ id: pending.proposal.id }) });
  expect(denied.status).toBe(403);
  expect(await db.agentMandate.count({ where: { originReference: pending.proposal.id } })).toBe(0);
  const seen = await customerDecision(pending.proposal.id, { token, decision: "view" });
  const yes = await consent(labRequest(`${origin}/consent/${pending.proposal.id}/decision`, { method: "POST",
    headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ token, decision: "yes", proposalHash: seen.proposalHash }) }),
    { params: Promise.resolve({ id: pending.proposal.id }) });
  expect(yes.status).toBe(200);
  const mandateId = (await getProposal(principal, pending.proposal.id)).proposal.mandateId!;
  const request = body(input, mandateId);
  const result = created(await createAgentBooking(principal, "flow", request));
  expect(result.replayed).toBe(false);
  const link = await db.agentBooking.findUniqueOrThrow({ where: { bookingId: result.booking.id } });
  expect(link.nativeBookingId).toBeNull();
  expect(await db.booking.count({ where: { id: result.booking.id } })).toBe(0);
  expect((await getBookingV1(principal, result.booking.id)).booking.id).toBe(result.booking.id);
  const replay = created(await createAgentBooking(principal, "flow", request));
  expect(replay).toEqual({ ...result, replayed: true });
  await expect(createAgentBooking(principal, "flow", { ...request, customer: { ...request.customer, name: "Changed synthetic name" } })).rejects.toMatchObject({ code: "idempotency_conflict" });
  await expect(createAgentBooking(principal, "another-key", request)).rejects.toMatchObject({ code: "mandate_denied" });
  const other = await actor();
  await expect(getBookingV1(other.principal, result.booking.id)).rejects.toMatchObject({ code: "booking_not_found" });
  await expect(cancelBookingV1(other.principal, result.booking.id)).rejects.toMatchObject({ code: "booking_not_found" });
  const chain = await readAudit({ businessId: "lab-partner", bookingId: result.booking.id, chain: "true" });
  expect(chain.events.map(e => e.event)).toEqual(["proposal.created", "proposal.viewed", "consent.approved", "mandate.created", "mandate.consumed", "booking.created"]);
  const cancelled = await cancelBookingV1(principal, result.booking.id);
  expect(cancelled.booking.status).toBe("cancelled");
  expect([...server!.state.bookings.values()][0].status).toBe("cancelled");
  const audit = await readAudit({ businessId: "lab-partner", bookingId: result.booking.id, chain: "true" });
  expect(audit.events.at(-1)?.event).toBe("booking.cancelled");
  for (const secret of [key, token, "partner-customer@example.test", "Synthetic customer", "pos-ticket", "Verbose private POS"])
    expect(JSON.stringify(audit)).not.toContain(secret);
  expect(server!.state.bookings.size).toBe(1);
});

it.each([false, true])("transport enforces write and read scopes for key/OAuth (%s)", async oauth => {
  const read = await actor(oauth, ["services:read"]);
  const input = await payload(read.principal);
  const send = (key: string, scope: "bookings:read" | "bookings:write") => agentRoute(new Request(`${origin}/api/v1/bookings`, {
    headers: { authorization: `Bearer ${key}` } }), "scope-test", scope,
    scope === "bookings:write" ? p => createAgentBooking(p, "scope", body(input)) : p => getBookingV1(p, "unknown"));
  expect((await send(read.key, "bookings:write")).status).toBe(403);
  expect((await send(read.key, "bookings:read")).status).toBe(403);
  const write = await actor(oauth, ["bookings:write"]);
  expect((await send(write.key, "bookings:read")).status).toBe(403);
  expect(server!.state.bookings.size).toBe(0);
});

it("partner collision leaves the losing mandate usable for another allowed time", async () => {
  const a = await actor(), b = await actor();
  const first = await payload(a.principal);
  const second = { ...first, start: DateTime.fromISO(first.start).plus({ hours: 1 }).toISO()! };
  async function mandate(p: AgentPrincipal) {
    return issueSyntheticMandate({ businessId: "lab-partner", clientId: p.clientId, serviceId: first.serviceId,
      staffId: first.staffId, validFrom: first.start, validUntil: DateTime.fromISO(first.start).plus({ hours: 3 }).toISO()!,
      expiresAt: new Date(Date.now() + 600000).toISOString(), maxPriceOre: 45000, currency: "SEK",
      origin: "synthetic-operator", originReference: "synthetic-collision-test" }, db);
  }
  const mandates = await Promise.all([mandate(a.principal), mandate(b.principal)]);
  const actors = [a, b];
  const results = await Promise.allSettled(actors.map((v, i) => createAgentBooking(v.principal, `collision-${i}`, body(first, mandates[i].id))));
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  const loser = results.findIndex(r => r.status === "rejected");
  expect((results[loser] as PromiseRejectedResult).reason).toMatchObject({ code: "slot_unavailable" });
  expect(server!.state.bookings.size).toBe(1);
  expect(await db.agentBooking.count({ where: { mandateId: mandates[loser].id } })).toBe(0);
  expect(await db.agentAuditEvent.count({ where: { mandateId: mandates[loser].id, event: "mandate.consumed" } })).toBe(0);
  expect(await db.partnerBookingAttempt.count({ where: { mandateId: mandates[loser].id } })).toBe(0);
  await createAgentBooking(actors[loser].principal, `retry-${loser}`, body(second, mandates[loser].id));
  expect(server!.state.bookings.size).toBe(2);
});

it("recovers an accepted partner booking after gateway failure, preserving the attempt binding", async () => {
  const { principal } = await actor(); const input = await payload(principal);
  const { mandateId } = await approved(principal, input);
  const request = body(input, mandateId);
  const original = provider.createBooking.bind(provider);
  let acceptedId = "";
  const interrupted = vi.spyOn(provider, "createBooking").mockImplementationOnce(async (...args) => {
    const row = await original(...args); acceptedId = row.id;
    throw new Error("SYNTHETIC_INTERRUPTION_AFTER_ACCEPT");
  });
  await expect(createAgentBooking(principal, "interrupted", request)).rejects.toThrow("SYNTHETIC_INTERRUPTION_AFTER_ACCEPT");
  expect(server!.state.bookings.size).toBe(1);
  expect(await db.agentBooking.count({ where: { mandateId } })).toBe(0);
  expect(await db.agentAuditEvent.count({ where: { mandateId, event: "mandate.consumed" } })).toBe(0);
  await expect(createAgentBooking(principal, "different-key", request)).rejects.toMatchObject({ code: "mandate_denied" });
  interrupted.mockRestore();
  const healed = created(await createAgentBooking(principal, "interrupted", request));
  expect(healed.booking.id).toBe(acceptedId);
  expect(server!.state.bookings.size).toBe(1);
  expect(await db.agentBooking.count({ where: { mandateId } })).toBe(1);
  expect(await db.agentAuditEvent.count({ where: { mandateId, event: "mandate.consumed" } })).toBe(1);
});

it("heals a partner-only acceptance using the same scoped key and payload", async () => {
  const { principal } = await actor(); const input = await payload(principal);
  const { mandateId } = await approved(principal, input);
  const row = await provider.createBooking({ serviceId: input.serviceId, serviceVersion: input.serviceVersion,
    staffId: input.staffId, start: input.start, customerName: "Synthetic customer", customerEmail: "partner-customer@example.test" },
    scopedIdempotencyKey(principal, "partner-only"), `${AGENT_API_CHANNEL}${principal.clientId}`);
  expect(await db.agentBooking.count({ where: { bookingId: row.id } })).toBe(0);
  const healed = created(await createAgentBooking(principal, "partner-only", body(input, mandateId)));
  expect(healed.booking.id).toBe(row.id);
  expect(server!.state.bookings.size).toBe(1);
});

it("invalid, revoked and tampered consent authority never reaches provider create", async () => {
  const { principal } = await actor(); const input = await payload(principal);
  const spy = vi.spyOn(provider, "createBooking");
  await expect(createAgentBooking(principal, "absent", body(input, "nonexistent"))).rejects.toMatchObject({ code: "mandate_denied" });
  const first = await approved(principal, input);
  const other = await actor();
  await expect(createAgentBooking(other.principal, "foreign-mandate", body(input, first.mandateId))).rejects.toMatchObject({ code: "mandate_denied" });
  await db.agentProposal.update({ where: { id: first.proposalId }, data: { priceOre: { increment: 1 } } });
  await expect(createAgentBooking(principal, "tampered", body(input, first.mandateId))).rejects.toMatchObject({ code: "mandate_denied" });
  const next = await approved(principal, input);
  await db.agentMandate.update({ where: { id: next.mandateId }, data: { revokedAt: new Date() } });
  await expect(createAgentBooking(principal, "revoked", body(input, next.mandateId))).rejects.toMatchObject({ code: "mandate_denied" });
  const expired = await approved(principal, input);
  await db.agentMandate.update({ where: { id: expired.mandateId }, data: { expiresAt: new Date(Date.now() - 1) } });
  await expect(createAgentBooking(principal, "expired", body(input, expired.mandateId))).rejects.toMatchObject({ code: "mandate_denied" });
  expect(spy).not.toHaveBeenCalled(); expect(server!.state.bookings.size).toBe(0);
});
