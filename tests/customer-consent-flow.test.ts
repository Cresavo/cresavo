import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AgentProposal } from "@prisma/client";
import type { AgentPrincipal } from "../src/lib/agent-api/keys";
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
      create: async ({ data }: { data: Record<string, unknown> }) => store.proposal = { id: "proposal-a", status: "pending", mandateId: null, createdAt: new Date(), ...data },
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
import { createProposal, customerDecision, getProposal, proposalHash } from "../src/lib/agent-api/proposals";
const principal: AgentPrincipal = { businessId: "demo", clientId: "client-a", keyId: "key-a", keyPrefix: "prefix-a", agentName: "Synthetic Agent", ownerName: "Synthetic Operator", kind: "registered-client", scopes: ["bookings:write"] };
const now = new Date("2026-11-16T08:00:00Z");
const input = { business: "demo", serviceId: "massage", serviceVersion: 3, staffId: "anna", start: "2026-11-17T10:00:00+01:00" };
beforeEach(() => {
  store.proposal = null; store.mandates = [];
  vi.stubEnv("BOOKING_CONSENT_LAB", "1"); vi.stubEnv("BOOKING_PUBLIC_ORIGIN", "http://127.0.0.1:3229");
  vi.stubEnv("BOOKING_RUNTIME", "local"); vi.stubEnv("DATABASE_URL", "postgresql://synthetic@127.0.0.1:1/package3_test");
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
async function pending() {
  const result = await createProposal(principal, input, now);
  const token = new URL(result.approvalUrl!).hash.slice(1);
  const seen = await customerDecision(result.proposal.id, { token, decision: "view" }, now);
  return { id: result.proposal.id, token, proposalHash: seen.proposalHash };
}
it("server snapshot and yes yield bounded client authority with exact proposal hash", async () => {
  const request = await pending();
  const row = store.proposal as AgentProposal;
  expect(row).toMatchObject({ duration: 30, priceOre: 45000, clientId: "client-a", locationId: "demo-location", scheduleId: "staff-schedule:anna" });
  expect(JSON.stringify(row)).not.toContain(request.token);
  await customerDecision(request.id, { token: request.token, proposalHash: request.proposalHash, decision: "yes" }, now);
  expect(store.mandates).toHaveLength(1);
  expect(store.mandates[0]).toMatchObject({ clientId: "client-a", origin: "customer-consent", originReference: request.id, proposalHash: proposalHash(row), serviceId: "massage", staffId: "anna", maxPriceOre: 45000, currency: "SEK", validFrom: row.startsAt, validUntil: new Date(+row.startsAt + 30 * 60000), expiresAt: new Date(+now + 600000) });
  expect((await getProposal(principal, request.id, now)).proposal.mandateId).toBe("mandate-a");
});
it.each(["yes", "no"] as const)("a %s link cannot create a second decision", async decision => {
  const r = await pending(); const body = { token: r.token, decision, proposalHash: r.proposalHash };
  await customerDecision(r.id, body, now);
  await expect(customerDecision(r.id, body, now)).rejects.toMatchObject({ code: "mandate_denied" });
  expect(store.mandates).toHaveLength(decision === "yes" ? 1 : 0);
});
it("expiry and invalid credentials cannot create authority", async () => {
  const r = await pending();
  await expect(customerDecision(r.id, { token: "z".repeat(43), decision: "yes", proposalHash: r.proposalHash }, now)).rejects.toMatchObject({ code: "mandate_denied" });
  await expect(customerDecision(r.id, { token: r.token, decision: "yes", proposalHash: r.proposalHash }, new Date(+now + 600000))).rejects.toMatchObject({ code: "mandate_denied" });
  expect(store.mandates).toHaveLength(0);
  expect((await getProposal(principal, r.id, new Date(+now + 600000))).proposal.status).toBe("expired");
});
it("foreign client receives the same not-found response", async () => {
  const r = await pending();
  await expect(getProposal({ ...principal, clientId: "other" }, r.id, now)).rejects.toMatchObject({ code: "booking_not_found" });
});
it("changing a viewed proposal fails before creating authority", async () => {
  const r = await pending(); (store.proposal as AgentProposal).priceOre = 44000;
  await expect(customerDecision(r.id, { token: r.token, decision: "yes", proposalHash: r.proposalHash }, now)).rejects.toMatchObject({ code: "mandate_denied" });
  expect(store.mandates).toHaveLength(0);
});
it("uses a short test-configured TTL and logs no credential", async () => {
  vi.stubEnv("BOOKING_CONSENT_TTL_SECONDS", "2");
  const logs = vi.spyOn(console, "info").mockImplementation(() => {});
  const r = await pending();
  expect(+(store.proposal as AgentProposal).expiresAt).toBe(+now + 2000);
  await customerDecision(r.id, { token: r.token, decision: "no", proposalHash: r.proposalHash }, now);
  expect(JSON.stringify(logs.mock.calls)).not.toContain(r.token);
});
