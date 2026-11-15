import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import { db } from "../../src/lib/db";
import { authenticateAgent, createAgentApiKey, type AgentPrincipal } from "../../src/lib/agent-api/keys";
import { createProposal, customerDecision, getProposal } from "../../src/lib/agent-api/proposals";
import { simulatedSmsSender } from "../../src/lib/agent-api/sms-otp";
import { createAgentBooking } from "../../src/lib/agent-api/bookings";
import { liveSnapshot } from "../../src/lib/agent-api/live";
import { readAudit } from "../../src/lib/agent-api/audit-read";
import { POST as consent } from "../../src/app/consent/[id]/decision/route";
import { POST as propose } from "../../src/app/api/v1/proposals/route";
import { POST as mcp } from "../../src/app/api/v1/mcp/route";
import { labRequest, origin, rpcBody } from "../helpers/oauth";

const clients: string[] = [];
const staffId = `sms-staff-${randomUUID()}`, serviceId = `sms-service-${randomUUID()}`;
const phone = "+46700" + "0".repeat(6);
let slot = 0;
beforeAll(async () => {
  await db.service.create({ data: { id: serviceId, businessId: "demo", name: "Syntetisk SMS-behandling", duration: 30, priceOre: 45000 } });
  const template = await db.staff.findUniqueOrThrow({ where: { id: "staff-erik" } });
  await db.staff.create({ data: { id: staffId, businessId: "demo", name: "Syntetisk SMS-personal", serviceIds: [serviceId], weekly: template.weekly!, exceptions: [] } });
});
beforeEach(() => {
  vi.stubEnv("BOOKING_CONSENT_LAB", "1"); vi.stubEnv("BOOKING_SMS_OTP_LAB", "1");
  vi.stubEnv("BOOKING_SMS_OTP_BUSINESSES", "demo"); vi.stubEnv("BOOKING_PUBLIC_ORIGIN", origin);
  vi.stubEnv("BOOKING_RUNTIME", "local"); vi.stubEnv("BOOKING_ADDRESS_SECRET", "synthetic-oauth-socket-proof");
  simulatedSmsSender.clear();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
afterAll(async () => {
  // AgentAuditEvent is append-only: preserve every audit row, including fixture events.
  const keys = await db.agentApiKey.findMany({ where: { clientId: { in: clients } } });
  const links = await db.agentBooking.findMany({ where: { clientId: { in: clients } } });
  await db.agentApiEvent.deleteMany({ where: { keyId: { in: keys.map(k => k.id) } } });
  await db.agentBooking.deleteMany({ where: { clientId: { in: clients } } });
  await db.booking.deleteMany({ where: { id: { in: links.map(l => l.bookingId) } } });
  await db.agentProposal.deleteMany({ where: { clientId: { in: clients } } });
  await db.agentMandate.deleteMany({ where: { clientId: { in: clients } } });
  await db.agentApiKey.deleteMany({ where: { clientId: { in: clients } } });
  await db.agentClient.deleteMany({ where: { id: { in: clients } } });
  await db.staff.deleteMany({ where: { id: staffId } });
  await db.service.deleteMany({ where: { id: serviceId } });
  await db.$disconnect();
});
async function actor() {
  const { key } = await createAgentApiKey({ businessId: "demo", agentName: "SMS Synthetic Agent", ownerName: "Synthetic Operator", ownerContact: "sms@example.test", scopes: ["bookings:write", "bookings:read"] }, db);
  const principal = await authenticateAgent(new Headers({ authorization: `Bearer ${key}` }), db, "bookings:write");
  clients.push(principal.clientId); return { key, principal };
}
async function input() {
  let day = DateTime.now().setZone("Europe/Stockholm").startOf("day").plus({ days: 20 + slot++ });
  while (day.weekday > 5) day = day.plus({ days: 1 });
  return { business: "demo", serviceId, staffId, serviceVersion: 1, start: day.set({ hour: 11 }).toISO()! };
}
async function pending(principal: AgentPrincipal, enabled = true) {
  const payload = await input();
  const now = new Date();
  const result = await createProposal(principal, { ...payload, ...(enabled ? { customerPhone: phone } : {}) }, now);
  const token = new URL(result.approvalUrl!).hash.slice(1);
  const seen = await customerDecision(result.proposal.id, { token, decision: "view" }, now);
  return { ...result, payload, token, hash: seen.proposalHash, now };
}
type Pending = Awaited<ReturnType<typeof pending>>;
const code = () => simulatedSmsSender.read().at(-1)!.code;
const decide = (r: Pending, decision: string, value?: string, at = r.now) => customerDecision(r.proposal.id, { token: r.token, decision, proposalHash: r.hash, ...(value === undefined ? {} : { code: value }) }, at);
const booking = (r: Pending, mandateId?: string) => ({ ...r.payload, confirmed: true, customer: { name: "Syntetisk SMS-kund", email: "sms-customer@example.test" }, ...(mandateId ? { mandateId } : {}) });
it("disabled path creates unmarked customer mandate without phone or code", async () => {
  vi.stubEnv("BOOKING_SMS_OTP_LAB", "0"); const { principal } = await actor(); const r = await pending(principal, false);
  await decide(r, "yes");
  const mandate = await db.agentMandate.findFirstOrThrow({ where: { originReference: r.proposal.id } });
  expect(mandate).toMatchObject({ origin: "customer-consent", verifiedVia: null });
  expect(simulatedSmsSender.read()).toHaveLength(0);
});
it("REST rejects missing and non synthetic phone; sends simulated OTP with no agent leak", async () => {
  const { key } = await actor(); const payload = await input();
  const call = (body: unknown) => propose(new Request(`${origin}/api/v1/proposals`, { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify(body) }));
  for (const customerPhone of [undefined, "invalid", "+46701" + "0".repeat(6)]) {
    const response = await call({ ...payload, customerPhone }); expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_request");
  }
  const response = await call({ ...payload, customerPhone: phone }); expect(response.status).toBe(201);
  const result = await response.json(); expect(simulatedSmsSender.read()).toHaveLength(1);
  for (const secret of [phone, code()]) expect(JSON.stringify(result)).not.toContain(secret);
});
it("MCP accepts additive phone but never returns OTP", async () => {
  const { key } = await actor();
  const response = await mcp(new Request(`${origin}/api/v1/mcp`, { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "create_proposal", arguments: { ...await input(), customerPhone: phone } } }) }));
  const result = await rpcBody(response); expect(result.result.isError).not.toBe(true);
  expect(simulatedSmsSender.read()).toHaveLength(1);
  for (const secret of [phone, code()]) expect(JSON.stringify(result)).not.toContain(secret);
});
it("HTTP denies absent/wrong OTP, accepts correct OTP and allows exactly the mandated booking", async () => {
  const logs = vi.spyOn(console, "info").mockImplementation(() => {});
  const { principal } = await actor(); const r = await pending(principal); const otp = code();
  const call = (value?: string) => consent(labRequest(`${origin}/consent/${r.proposal.id}/decision`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ token: r.token, proposalHash: r.hash, decision: "yes", code: value }) }), { params: Promise.resolve({ id: r.proposal.id }) });
  for (const value of [undefined, "wrong"]) expect((await call(value)).status).toBe(403);
  expect(await db.agentMandate.count({ where: { originReference: r.proposal.id } })).toBe(0);
  expect((await call(otp)).status).toBe(200);
  const mandate = await db.agentMandate.findFirstOrThrow({ where: { originReference: r.proposal.id } });
  expect(mandate).toMatchObject({ origin: "customer-consent", verifiedVia: "sms-otp" });
  await createAgentBooking(principal, `sms-${randomUUID()}`, booking(r, mandate.id));
  const output = JSON.stringify({ audit: await readAudit({ proposalId: r.proposal.id, chain: "true" }), live: await liveSnapshot(), logs: logs.mock.calls, status: await getProposal(principal, r.proposal.id) });
  for (const secret of [phone, otp, r.token]) expect(output).not.toContain(secret);
  const stored = await db.agentProposal.findUniqueOrThrow({ where: { id: r.proposal.id } });
  expect(stored.phoneHash).toMatch(/^[a-f0-9]{64}$/); expect(stored.otpHash).toMatch(/^[a-f0-9]{64}$/);
  for (const secret of [phone, otp, r.token]) expect(JSON.stringify(stored)).not.toContain(secret);
});
it("no requires no code and leaves booking without authority", async () => {
  const { principal } = await actor(); const r = await pending(principal); await decide(r, "no");
  expect(await db.agentMandate.count({ where: { originReference: r.proposal.id } })).toBe(0);
  await expect(createAgentBooking(principal, "sms-declined", booking(r))).rejects.toMatchObject({ code: "mandate_required" });
});
it("five attempts block correct OTP; resend resets attempts and invalidates old OTP", async () => {
  const { principal } = await actor(); const r = await pending(principal); const old = code();
  for (let i = 0; i < 6; i++) await expect(decide(r, "yes", "wrong")).rejects.toMatchObject({ code: "mandate_denied" });
  expect((await db.agentProposal.findUniqueOrThrow({ where: { id: r.proposal.id } })).otpAttempts).toBe(5);
  await expect(decide(r, "yes", old)).rejects.toMatchObject({ code: "mandate_denied" });
  await expect(decide(r, "resend")).rejects.toMatchObject({ code: "rate_limited" });
  const later = new Date(+r.now + 60000); await decide(r, "resend", undefined, later);
  expect(code()).not.toBe(old);
  await expect(decide(r, "yes", old, later)).rejects.toMatchObject({ code: "mandate_denied" });
  await decide(r, "yes", code(), later);
  const events = (await readAudit({ proposalId: r.proposal.id })).events.map(e => e.event);
  expect(events).toContain("sms_otp.resent"); expect(events).toContain("sms_otp.verified");
});
it("expired OTP with valid link can be replaced; snapshot survives configuration change", async () => {
  vi.stubEnv("BOOKING_SMS_OTP_TTL_SECONDS", "1"); vi.stubEnv("BOOKING_SMS_OTP_RESEND_SECONDS", "1");
  const { principal } = await actor(); const r = await pending(principal); const later = new Date(+r.now + 2000);
  vi.stubEnv("BOOKING_SMS_OTP_LAB", "0"); vi.stubEnv("BOOKING_SMS_OTP_BUSINESSES", "");
  await expect(decide(r, "yes", code(), later)).rejects.toMatchObject({ code: "mandate_denied" });
  await decide(r, "resend", undefined, later); await decide(r, "yes", code(), later);
  expect((await db.agentMandate.findFirstOrThrow({ where: { originReference: r.proposal.id } })).verifiedVia).toBe("sms-otp");
});
it("foreign client cannot get proposal or use verified mandate", async () => {
  const a = await actor(), b = await actor(); const r = await pending(a.principal);
  await expect(getProposal(b.principal, r.proposal.id)).rejects.toMatchObject({ code: "booking_not_found" });
  await decide(r, "yes", code());
  const mandateId = (await getProposal(a.principal, r.proposal.id)).proposal.mandateId!;
  await expect(createAgentBooking(b.principal, "sms-foreign", booking(r, mandateId))).rejects.toMatchObject({ code: "mandate_denied" });
});
it("concurrent correct yes commits one mandate and consumes link", async () => {
  const { principal } = await actor(); const r = await pending(principal); const otp = code();
  const results = await Promise.allSettled([1, 2].map(() => decide(r, "yes", otp)));
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(await db.agentMandate.count({ where: { originReference: r.proposal.id } })).toBe(1);
});
