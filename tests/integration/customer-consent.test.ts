import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import { db } from "../../src/lib/db";
import { authenticateAgent, createAgentApiKey, type AgentPrincipal } from "../../src/lib/agent-api/keys";
import { customerDecision, createProposal, getProposal, proposalHash } from "../../src/lib/agent-api/proposals";
import { simulatedEmailCodeSender } from "../../src/lib/agent-api/email-code-consent";
import { readAudit } from "../../src/lib/agent-api/audit-read";
import { cancelBookingV1, createAgentBooking } from "../../src/lib/agent-api/bookings";
import { POST as propose } from "../../src/app/api/v1/proposals/route";
import { GET as getStatus } from "../../src/app/api/v1/proposals/[id]/route";
import { POST as consent } from "../../src/app/consent/[id]/decision/route";
import { POST as mcp } from "../../src/app/api/v1/mcp/route";
import { labRequest, origin, rpcBody } from "../helpers/lab-request";
import { deleteGrants, grantToken } from "../helpers/agent-grant";
import { POST as salonMcp } from "../../src/app/api/v1/salons/[business]/mcp/route";
const clients: string[] = [];
const oauthClients: string[] = [];
let slot = 0;
const serviceId = `consent-service-${randomUUID()}`;
const staffId = `consent-staff-${randomUUID()}`;
const otherStaffId = `consent-other-${randomUUID()}`;
beforeAll(async () => {
  await db.service.create({ data: { id: serviceId, businessId: "demo", name: "Syntetisk samtyckesbehandling", duration: 30, priceOre: 45000 } });
  const template = await db.staff.findUniqueOrThrow({ where: { id: "staff-erik" } });
  for (const id of [staffId, otherStaffId]) await db.staff.create({ data: { id, businessId: "demo", name: "Syntetisk Samtyckespersonal", serviceIds: [serviceId, "massage"], weekly: template.weekly!, exceptions: [] } });
});
beforeEach(() => {
  vi.stubEnv("BOOKING_CONSENT_LAB", "1");
  vi.stubEnv("BOOKING_PUBLIC_ORIGIN", origin); vi.stubEnv("BOOKING_RUNTIME", "local");
  vi.stubEnv("BOOKING_ADDRESS_SECRET", "synthetic-oauth-socket-proof"); vi.stubEnv("AGENT_OAUTH", "1");
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
afterAll(async () => {
  await deleteGrants(oauthClients);
  const keys = await db.agentApiKey.findMany({ where: { clientId: { in: clients } } });
  const links = await db.agentBooking.findMany({ where: { clientId: { in: clients } } });
  await db.agentApiEvent.deleteMany({ where: { keyId: { in: keys.map(k => k.id) } } });
  await db.agentBooking.deleteMany({ where: { clientId: { in: clients } } });
  await db.booking.deleteMany({ where: { id: { in: links.map(l => l.bookingId) } } });
  await db.agentProposal.deleteMany({ where: { clientId: { in: clients } } });
  await db.agentMandate.deleteMany({ where: { clientId: { in: clients } } });
  await db.agentApiKey.deleteMany({ where: { clientId: { in: clients } } });
  await db.agentClient.deleteMany({ where: { id: { in: clients } } });
  await db.staff.deleteMany({ where: { id: { in: [staffId, otherStaffId] } } });
  await db.service.deleteMany({ where: { id: serviceId } });
  await db.$disconnect();
});
async function actor(oauth = false, scopes = ["services:read", "bookings:read", "bookings:write"]) {
  const grant = oauth ? await grantToken("demo", scopes) : null;
  if (grant) oauthClients.push(grant.oauthClientId);
  const key = grant ? grant.accessToken : (await createAgentApiKey({ businessId: "demo", agentName: "Consent synthetic test", ownerName: "Synthetic Operator", ownerContact: "consent@example.test", scopes }, db)).key;
  const principal = await authenticateAgent(new Headers({ authorization: `Bearer ${key}` }), db, scopes[0] as "bookings:write");
  clients.push(principal.clientId); return { key, principal };
}
async function input() {
  let day = DateTime.now().setZone("Europe/Stockholm").startOf("day").plus({ days: 24 + slot++ });
  while (day.weekday > 5) day = day.plus({ days: 1 });
  const service = await db.service.findUniqueOrThrow({ where: { id: serviceId } });
  return { business: "demo", serviceId: service.id, serviceVersion: service.version, staffId, start: day.set({ hour: 11 }).toISO()! };
}
const customerEmail = "consent-test@example.test";
// The customer types their own address on the consent page and reads the code from their inbox.
async function codeFor(id: string) {
  await customerDecision(id, { decision: "send-code", email: customerEmail });
  return simulatedEmailCodeSender.read().at(-1)!.code;
}
async function pending(p: AgentPrincipal) {
  const payload = await input();
  const result = await createProposal(p, payload);
  return { ...result, payload, code: await codeFor(result.proposal.id) };
}
async function decision(id: string, code: string, value: "yes" | "no") {
  const seen = await customerDecision(id, { decision: "view" }) as { proposalHash: string };
  return customerDecision(id, { decision: value, proposalHash: seen.proposalHash, code });
}
const wrong = (code: string) => code === "000000" ? "000001" : "000000";
const booking = (payload: Awaited<ReturnType<typeof input>>, mandateId?: string) => ({ ...payload, confirmed: true, customer: { name: "Syntetisk Testkund", email: customerEmail }, ...(mandateId ? { mandateId } : {}) });
it.each([false, true])("customer yes creates exact authority, usable by key/OAuth (%s)", async oauth => {
  const { principal } = await actor(oauth);
  const r = await pending(principal);
  await decision(r.proposal.id, r.code, "yes");
  const approved = await getProposal(principal, r.proposal.id);
  const mandate = await db.agentMandate.findUniqueOrThrow({ where: { id: approved.proposal.mandateId! } });
  const proposal = await db.agentProposal.findUniqueOrThrow({ where: { id: r.proposal.id } });
  expect(mandate).toMatchObject({ clientId: principal.clientId, origin: "customer-consent", proposalHash: proposalHash(proposal), serviceId: r.payload.serviceId, staffId: r.payload.staffId, locationId: proposal.locationId, scheduleId: proposal.scheduleId, maxPriceOre: proposal.priceOre, currency: "SEK" });
  expect(+mandate.validFrom).toBe(+proposal.startsAt);
  expect(+mandate.validUntil).toBe(+proposal.startsAt + proposal.duration * 60000);
  expect(+mandate.expiresAt).toBe(+proposal.expiresAt);
  expect(+proposal.expiresAt - +proposal.createdAt).toBeLessThanOrEqual(600000);
  const created = await createAgentBooking(principal, `yes-${slot}`, booking(r.payload, mandate.id));
  const bookingId = (created as { body: { booking: { id: string } } }).body.booking.id;
  for (const query of [{ bookingId }, { mandateId: mandate.id }, { proposalId: r.proposal.id }]) {
    const chain = await readAudit({ ...query, chain: "true" });
    expect(chain.events.map(e => e.event)).toEqual(["proposal.created", "email_code.sent", "proposal.viewed", "email_code.verified", "consent.approved", "mandate.created", "mandate.consumed", "booking.created"]);
    for (const secret of [r.code, "Syntetisk Testkund", "consent-test@example.test"]) expect(JSON.stringify(chain)).not.toContain(secret);
  }
  await cancelBookingV1(principal, bookingId);
  expect((await readAudit({ bookingId, chain: "true" })).events.at(-1)?.event).toBe("booking.cancelled");
  await expect(createAgentBooking(principal, `reuse-${slot}`, booking(r.payload, mandate.id))).rejects.toMatchObject({ code: "mandate_denied" });
});
it.each(["yes", "no"] as const)("consumes link once after %s, including concurrent replay", async value => {
  const { principal } = await actor(); const r = await pending(principal);
  const seen = await customerDecision(r.proposal.id, { decision: "view" }) as { proposalHash: string };
  const results = await Promise.allSettled([1, 2].map(() => customerDecision(r.proposal.id, { decision: value, proposalHash: seen.proposalHash, code: r.code })));
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(await db.agentMandate.count({ where: { originReference: r.proposal.id } })).toBe(value === "yes" ? 1 : 0);
  await expect(decision(r.proposal.id, r.code, "yes")).rejects.toMatchObject({ code: "mandate_denied" });
  if (value === "no") await expect(createAgentBooking(principal, "declined", booking(r.payload))).rejects.toMatchObject({ code: "mandate_required" });
});
it("expired and wrong codes create no mandate", async () => {
  const { principal } = await actor(); const r = await pending(principal);
  await expect(decision(r.proposal.id, wrong(r.code), "yes")).rejects.toMatchObject({ code: "mandate_denied" });
  await db.agentProposal.update({ where: { id: r.proposal.id }, data: { expiresAt: new Date(Date.now() - 1) } });
  expect((await getProposal(principal, r.proposal.id)).proposal.status).toBe("expired");
  await expect(decision(r.proposal.id, r.code, "yes")).rejects.toMatchObject({ code: "mandate_denied" });
  expect(await db.agentMandate.count({ where: { originReference: r.proposal.id } })).toBe(0);
  await expect(createAgentBooking(principal, "expired", booking(r.payload))).rejects.toMatchObject({ code: "mandate_required" });
});
it("other clients cannot read proposals or use customer mandates", async () => {
  const a = await actor(), b = await actor(); const r = await pending(a.principal);
  const response = await getStatus(new Request(`${origin}/api/v1/proposals/${r.proposal.id}`, { headers: { authorization: `Bearer ${b.key}` } }), { params: Promise.resolve({ id: r.proposal.id }) });
  expect(response.status).toBe(404);
  await decision(r.proposal.id, r.code, "yes");
  const mandateId = (await getProposal(a.principal, r.proposal.id)).proposal.mandateId!;
  await expect(createAgentBooking(b.principal, "foreign", booking(r.payload, mandateId))).rejects.toMatchObject({ code: "mandate_denied" });
});
it("changing a stored proposal after yes invalidates its mandate", async () => {
  const { principal } = await actor(); const r = await pending(principal);
  await decision(r.proposal.id, r.code, "yes");
  const mandateId = (await getProposal(principal, r.proposal.id)).proposal.mandateId!;
  await db.agentProposal.update({ where: { id: r.proposal.id }, data: { duration: { increment: 1 } } });
  await expect(createAgentBooking(principal, "tampered", booking(r.payload, mandateId))).rejects.toMatchObject({ code: "mandate_denied" });
});
it("booking at a different available time is denied", async () => {
  const { principal } = await actor(); const r = await pending(principal);
  await decision(r.proposal.id, r.code, "yes");
  const mandateId = (await getProposal(principal, r.proposal.id)).proposal.mandateId!;
  await expect(createAgentBooking(principal, "different-time", booking({ ...r.payload, start: DateTime.fromISO(r.payload.start).plus({ hours: 1 }).toISO()! }, mandateId))).rejects.toMatchObject({ code: "mandate_denied" });
});
it("agent cannot approve via MCP or customer POST, nor issue authority via confirmed", async () => {
  const { key, principal } = await actor(); const r = await pending(principal);
  for (const code of [undefined, wrong(r.code), r.code]) {
    const response = await consent(labRequest(`${origin}/consent/${r.proposal.id}/decision`, { method: "POST", headers: { origin, authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ code, decision: "yes" }) }), { params: Promise.resolve({ id: r.proposal.id }) });
    expect(response.status).toBe(403);
  }
  const response = await mcp(new Request(`${origin}/api/v1/mcp`, { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "approve_proposal", arguments: { proposalId: r.proposal.id } } }) }));
  const rpc = await rpcBody(response); expect(rpc.error || rpc.result?.isError).toBeTruthy();
  await expect(createAgentBooking(principal, "self-approve", booking(r.payload))).rejects.toMatchObject({ code: "mandate_required" });
  expect(await db.agentMandate.count({ where: { originReference: r.proposal.id } })).toBe(0);
});
it("REST proposal scopes allow write-only status but no read-only creation", async () => {
  const a = await actor(false, ["bookings:write"]), b = await actor(false, ["bookings:read"]);
  const payload = await input();
  const request = (key: string) => new Request(`${origin}/api/v1/proposals`, { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify(payload) });
  expect((await propose(request(b.key))).status).toBe(403);
  const response = await propose(request(a.key)); expect(response.status).toBe(201);
  const r = await response.json();
  expect((await getStatus(new Request(`${origin}/api/v1/proposals/${r.proposal.id}`, { headers: { authorization: `Bearer ${a.key}` } }), { params: Promise.resolve({ id: r.proposal.id }) })).status).toBe(200);
});
it("customer HTTP yes and logs/live do not expose the consent code", async () => {
  const logs = vi.spyOn(console, "info").mockImplementation(() => {});
  const { principal, key } = await actor(); const r = await pending(principal);
  const seen = await customerDecision(r.proposal.id, { decision: "view" }) as { proposalHash: string };
  const response = await consent(labRequest(`${origin}/consent/${r.proposal.id}/decision`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ code: r.code, decision: "yes", proposalHash: seen.proposalHash }) }), { params: Promise.resolve({ id: r.proposal.id }) });
  expect(response.status).toBe(200);
  const output = JSON.stringify({ logs: logs.mock.calls, status: await getProposal(principal, r.proposal.id) });
  for (const secret of [r.code, key, "PRIVATE KEY", "consent@example.test"]) expect(output).not.toContain(secret);
});

it.each(["priceOre", "duration"] as const)("current catalog %s changes cannot widen consent", async field => {
  const { principal } = await actor(); const r = await pending(principal);
  await decision(r.proposal.id, r.code, "yes");
  const mandateId = (await getProposal(principal, r.proposal.id)).proposal.mandateId!;
  const original = await db.service.findUniqueOrThrow({ where: { id: serviceId } });
  try {
    await db.service.update({ where: { id: serviceId }, data: { [field]: original[field] - 1, version: { increment: 1 } } });
    await expect(createAgentBooking(principal, `changed-${field}`, booking({ ...r.payload, serviceVersion: original.version + 1 }, mandateId))).rejects.toMatchObject({ code: "mandate_denied" });
  } finally {
    await db.service.update({ where: { id: serviceId }, data: { priceOre: original.priceOre, duration: original.duration, version: { increment: 1 } } });
  }
});
it.each(["service", "staff"])("different %s cannot use an approved mandate", async field => {
  const { principal } = await actor(); const r = await pending(principal);
  await decision(r.proposal.id, r.code, "yes");
  const mandateId = (await getProposal(principal, r.proposal.id)).proposal.mandateId!;
  const service = await db.service.findUniqueOrThrow({ where: { id: "massage" } });
  const changed = field === "staff" ? { ...r.payload, staffId: otherStaffId } : { ...r.payload, serviceId: service.id, serviceVersion: service.version };
  await expect(createAgentBooking(principal, `changed-${field}`, booking(changed, mandateId))).rejects.toMatchObject({ code: "mandate_denied" });
});
it.each([false, true])("MCP creation and write-only status share the REST flow (%s)", async oauth => {
  const { key, principal } = await actor(oauth, ["bookings:write"]);
  // A customer agent's OAuth token is valid only at its salon's MCP resource.
  const call = (name: string, args: unknown) => {
    const request = new Request(`${origin}/api/v1/${oauth ? "salons/demo/" : ""}mcp`, { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) });
    return oauth ? salonMcp(request, { params: Promise.resolve({ business: "demo" }) }) : mcp(request);
  };
  const response = await call("create_proposal", await input()); expect(response.status).toBe(200);
  const r = (await rpcBody(response)).result.structuredContent;
  expect(r.consentUrl).toBe(`${origin}/consent/${r.proposal.id}`);
  await decision(r.proposal.id, await codeFor(r.proposal.id), "yes");
  const status = (await rpcBody(await call("get_proposal", { proposalId: r.proposal.id }))).result.structuredContent;
  expect(status.proposal.mandateId).toBe((await getProposal(principal, r.proposal.id)).proposal.mandateId);
});
