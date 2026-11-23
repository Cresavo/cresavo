import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AgentProposal } from "@prisma/client";
import type { AgentPrincipal } from "../src/lib/agent-api/keys";
const audit = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/agent-api/audit", () => ({ recordAudit: audit, recordAuditInTransaction: (_tx: unknown, input: unknown) => audit(input), auditContext: (run: () => unknown) => run() }));
const store = vi.hoisted(() => ({ proposal: null as unknown, mandates: [] as Record<string, unknown>[] }));
vi.mock("../src/lib/db", () => {
  const tx = {
    $queryRaw: async (parts: TemplateStringsArray, ...values: unknown[]) => {
      if (parts.join("").includes('"AgentClient"')) return [{ id: "client-a" }];
      const row = store.proposal as AgentProposal | null;
      return row && row.id === values[0] && row.tokenHash === values[1] ? [row] : [];
    },
    service: { findFirst: async () => ({ id: "massage", version: 3, name: "Syntetisk behandling", duration: 30, priceOre: 45000 }) },
    staff: { findFirst: async () => ({ id: "anna", name: "Syntetisk Personal", serviceIds: ["massage"] }) },
    agentProposal: {
      create: async ({ data }: { data: Record<string, unknown> }) => store.proposal = { id: "proposal-a", status: "pending", mandateId: null, otpAttempts: 0, createdAt: new Date(), ...data },
      update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(store.proposal as object, data),
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const row = store.proposal as Record<string, unknown>;
        return Object.entries(where).every(([k, v]) => row?.[k] === v) ? row : null;
      },
    },
    agentMandate: { create: async ({ data }: { data: Record<string, unknown> }) => { const m = { id: "mandate-a", ...data }; store.mandates.push(m); return m; } },
  };
  return { db: { ...tx, $transaction: async (fn: (arg: typeof tx) => unknown) => fn(tx) } };
});
vi.mock("../src/lib/workspace-write", () => ({ lockConfiguration: vi.fn() }));
vi.mock("../src/lib/agent-api/mandates", () => ({ assertCurrentAgent: vi.fn() }));
import { createProposal, customerDecision, getProposal } from "../src/lib/agent-api/proposals";
const principal: AgentPrincipal = { businessId: "demo", clientId: "client-a", keyId: "key-a", keyPrefix: "prefix-a", agentName: "Synthetic Agent", ownerName: "Synthetic Operator", kind: "registered-client", scopes: ["bookings:write"] };
const now = new Date("2026-11-16T08:00:00Z");
const input = { business: "demo", serviceId: "massage", serviceVersion: 3, staffId: "anna", start: "2026-11-17T10:00:00+01:00" };
beforeEach(() => {
  audit.mockClear(); simulatedSmsSender.clear();
  vi.stubEnv("BOOKING_SMS_OTP_LAB", "1"); vi.stubEnv("BOOKING_SMS_OTP_BUSINESSES", "demo");
  store.proposal = null; store.mandates = [];
  vi.stubEnv("BOOKING_CONSENT_LAB", "1"); vi.stubEnv("BOOKING_PUBLIC_ORIGIN", "http://127.0.0.1:3229");
  vi.stubEnv("BOOKING_RUNTIME", "local"); vi.stubEnv("DATABASE_URL", "postgresql://synthetic@127.0.0.1:1/package3_test");
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

import { simulatedSmsSender, syntheticPhone, smsOtpRequired, otpHash } from "../src/lib/agent-api/sms-otp";
const phone = "+46701740605";
async function pending(enabled = true) {
  if (!enabled) vi.stubEnv("BOOKING_SMS_OTP_LAB", "0");
  const result = await createProposal(principal, { ...input, ...(enabled ? { customerPhone: phone } : {}) }, now);
  const token = new URL(result.approvalUrl!).hash.slice(1);
  const seen = await customerDecision(result.proposal.id, { token, decision: "view" }, now);
  return { id: result.proposal.id, token, proposalHash: seen.proposalHash, result, seen };
}
const row = () => store.proposal as AgentProposal;
const code = () => simulatedSmsSender.read().at(-1)!.code;
const decide = (r: Awaited<ReturnType<typeof pending>>, decision = "yes", value?: string, at = now) => customerDecision(r.id, { token: r.token, proposalHash: r.proposalHash, decision, ...(value === undefined ? {} : { code: value }) }, at);
it("disabled lab preserves link-only approval and null verification", async () => {
  const r = await pending(false); await decide(r);
  expect(store.mandates[0]).toMatchObject({ origin: "customer-consent", verifiedVia: null });
  expect(simulatedSmsSender.read()).toHaveLength(0);
});
it.each(["", "other", "lab-partner"])("business list %s does not enable demo", value => {
  vi.stubEnv("BOOKING_SMS_OTP_BUSINESSES", value); expect(smsOtpRequired("demo")).toBe(false);
});
it("lab switch dominates the business list", () => {
  vi.stubEnv("BOOKING_SMS_OTP_LAB", "0"); expect(smsOtpRequired("demo")).toBe(false);
});
it.each(["BOOKING_CONSENT_LAB", "BOOKING_RUNTIME", "BOOKING_PUBLIC_ORIGIN", "DATABASE_URL"])("lab guard rejects unsafe %s", key => {
  vi.stubEnv(key, ({ BOOKING_CONSENT_LAB: "0", BOOKING_RUNTIME: "vercel", BOOKING_PUBLIC_ORIGIN: "https://invalid.example", DATABASE_URL: "postgresql://synthetic@127.0.0.1:1/unsafe" })[key]!);
  expect(() => smsOtpRequired("demo")).toThrow();
});
it("requires phone when enabled, rejects supplied phone when disabled", async () => {
  await expect(createProposal(principal, input, now)).rejects.toMatchObject({ code: "invalid_request" });
  vi.stubEnv("BOOKING_SMS_OTP_LAB", "0");
  await expect(createProposal(principal, { ...input, customerPhone: phone }, now)).rejects.toMatchObject({ code: "invalid_request" });
});
it.each(["+46701740605", "+46701740650", "+46701740699"])("accepts the PTS fictional mobile number %s", value => {
  expect(syntheticPhone(value).phoneMask).toBe("+46701740***");
});
it.each([undefined, "123", "+46701740604", "+46701740600", "+46701740700", "+46701740599", "+4670174060", "+467017406050", "+46700000000", "0701740605", "070-174 06 05", "+46 70 174 06 05", "+4670174060a"])("rejects %s, which is not a PTS fictional mobile number in E.164", value => {
  expect(() => syntheticPhone(value)).toThrow();
});
it("stores only purpose hashes; SMS inbox alone contains code", async () => {
  const logs = vi.spyOn(console, "info").mockImplementation(() => {});
  const r = await pending(); const otp = code();
  expect(otp).toMatch(/^[0-9]{6}$/); expect(row().otpHash).toBe(otpHash(r.id, otp));
  expect(row().phoneHash).toMatch(/^[a-f0-9]{64}$/);
  const output = JSON.stringify({ row: row(), result: r.result.proposal, seen: r.seen, logs: logs.mock.calls, audit: audit.mock.calls });
  for (const secret of [phone, otp, r.token]) expect(output).not.toContain(secret);
  expect(JSON.stringify(r.result)).not.toContain(otp);
  expect(simulatedSmsSender.read()[0].phoneMask).toBe("+46701740***");
});
it("missing and wrong codes persist attempts without authority; correct code verifies", async () => {
  const r = await pending(); const otp = code();
  for (const value of [undefined, "bad"]) await expect(decide(r, "yes", value)).rejects.toMatchObject({ code: "mandate_denied" });
  expect(row().otpAttempts).toBe(2); expect(store.mandates).toHaveLength(0);
  await decide(r, "yes", otp);
  expect(store.mandates[0]).toMatchObject({ origin: "customer-consent", verifiedVia: "sms-otp" });
  expect(row().otpVerifiedAt).toEqual(now);
});
it("snapshot survives flags changing off", async () => {
  const r = await pending(); vi.stubEnv("BOOKING_SMS_OTP_LAB", "0"); vi.stubEnv("BOOKING_SMS_OTP_BUSINESSES", "");
  await expect(decide(r)).rejects.toMatchObject({ code: "mandate_denied" });
  await decide(r, "yes", code()); expect(store.mandates[0].verifiedVia).toBe("sms-otp");
});
it("five failures lock even correct code; rate limited resend commits no replacement; later resend resets", async () => {
  const r = await pending(); const old = code();
  for (let i = 0; i < 6; i++) await expect(decide(r, "yes", "wrong")).rejects.toMatchObject({ code: "mandate_denied" });
  expect(row().otpAttempts).toBe(5);
  await expect(decide(r, "yes", old)).rejects.toMatchObject({ code: "mandate_denied" });
  await expect(decide(r, "resend")).rejects.toMatchObject({ code: "rate_limited" });
  expect(code()).toBe(old);
  const later = new Date(+now + 60000);
  await decide(r, "resend", undefined, later); expect(row().otpAttempts).toBe(0); expect(code()).not.toBe(old);
  await expect(decide(r, "yes", old, later)).rejects.toMatchObject({ code: "mandate_denied" });
  await decide(r, "yes", code(), later); expect(store.mandates).toHaveLength(1);
  expect(audit.mock.calls.map(c => c[0].event)).toContain("sms_otp.resent");
});
it("expired code cannot approve; fresh code can", async () => {
  vi.stubEnv("BOOKING_SMS_OTP_TTL_SECONDS", "1"); vi.stubEnv("BOOKING_SMS_OTP_RESEND_SECONDS", "1");
  const r = await pending(); const later = new Date(+now + 2000);
  await expect(decide(r, "yes", code(), later)).rejects.toMatchObject({ code: "mandate_denied" });
  await decide(r, "resend", undefined, later); await decide(r, "yes", code(), later);
  expect(store.mandates).toHaveLength(1);
});
it("no needs no code and cannot later approve or resend", async () => {
  const r = await pending(); await decide(r, "no"); expect(store.mandates).toHaveLength(0);
  for (const decision of ["yes", "resend"]) await expect(decide(r, decision, code(), new Date(+now + 60000))).rejects.toMatchObject({ code: "mandate_denied" });
});
it("wrong bearer cannot view or resend and foreign agent sees not found", async () => {
  const r = await pending();
  for (const decision of ["view", "resend"]) await expect(customerDecision(r.id, { token: "x".repeat(43), decision }, new Date(+now + 60000))).rejects.toMatchObject({ code: "mandate_denied" });
  await expect(getProposal({ ...principal, clientId: "foreign" }, r.id, now)).rejects.toMatchObject({ code: "booking_not_found" });
});

import { POST } from "../src/app/consent/[id]/decision/route";
import { createHmac } from "node:crypto";
it("customer HTTP keeps failures generic and supports resend followed by verified yes", async () => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(now);
  vi.stubEnv("BOOKING_ADDRESS_SECRET", "synthetic-sms-socket-proof");
  const r = await pending();
  const origin = "http://127.0.0.1:3229";
  const post = (body: unknown) => POST(new Request(`${origin}/consent/${r.id}/decision`, {
    method: "POST", headers: { origin, "content-type": "application/json",
      "x-booking-client-ip": "127.0.0.1", "x-booking-client-proof": createHmac("sha256", "synthetic-sms-socket-proof").update("127.0.0.1").digest("hex") },
    body: JSON.stringify(body),
  }), { params: Promise.resolve({ id: r.id }) });
  for (const value of [undefined, "wrong"]) {
    const response = await post({ token: r.token, decision: "yes", proposalHash: r.proposalHash, code: value });
    expect(response.status).toBe(403); expect(await response.json()).toEqual({ error: "consent_denied" });
  }
  expect(store.mandates).toHaveLength(0);
  expect((await post({ token: r.token, decision: "resend" })).status).toBe(403);
  vi.setSystemTime(new Date(+now + 60000));
  expect((await post({ token: r.token, decision: "resend" })).status).toBe(200);
  expect((await post({ token: r.token, decision: "yes", proposalHash: r.proposalHash, code: code() })).status).toBe(200);
  expect(store.mandates[0].verifiedVia).toBe("sms-otp");
});
it.each(["BOOKING_SMS_OTP_TTL_SECONDS", "BOOKING_SMS_OTP_RESEND_SECONDS"])("rejects invalid %s configuration", async name => {
  const r = await pending(); vi.stubEnv(name, "0");
  if (name.includes("TTL")) await expect(createProposal(principal, { ...input, customerPhone: phone }, now)).rejects.toMatchObject({ code: "invalid_request" });
  else await expect(decide(r, "resend", undefined, new Date(+now + 60000))).rejects.toMatchObject({ code: "invalid_request" });
});
