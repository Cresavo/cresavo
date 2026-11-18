import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ create: vi.fn(), admin: vi.fn() }));
vi.mock("../src/lib/db", () => ({ db: { agentAuditEvent: { create: state.create } } }));
vi.mock("../src/lib/admin-http", () => ({ requireAdmin: state.admin }));
import { recordAudit, auditContext, auditMutations } from "../src/lib/agent-api/audit";
import { GET } from "../src/app/api/admin/audit/route";
import { DomainError } from "../src/lib/errors";
import { mandateSchema, type StoredMandate } from "../src/lib/agent-api/mandate-policy";
import { proposalSchema } from "../src/lib/agent-api/proposals";
import { agentBookingSchema } from "../src/lib/agent-api/bookings";
import type { PaymentAuthorizationToken } from "../src/lib/agent-api/payment-contract";
beforeEach(() => { state.create.mockReset().mockResolvedValue({}); });
it("records only validated redacted data and shares server-generated correlation", async () => {
  await auditContext(async () => {
    await recordAudit({ event: "proposal.created", outcome: "pending", proposalId: "proposal-1" });
    await recordAudit({ event: "consent.approved", outcome: "success", proposalId: "proposal-1", mandateId: "mandate-1" });
  });
  const rows = state.create.mock.calls.map(c => c[0].data);
  expect(rows).toHaveLength(2); expect(rows[0].requestId).toBe(rows[1].requestId);
  expect(rows[0].requestId).toMatch(/^[a-f0-9-]{36}$/);
});
it("rejects unknown fields and logs a static error even when insert fails", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  await recordAudit({ event: "agent.request", outcome: "200", token: "secret@example.test" } as never);
  expect(state.create).not.toHaveBeenCalled();
  state.create.mockRejectedValue(new Error("private-token"));
  await expect(recordAudit({ event: "agent.request", outcome: "200" })).resolves.toBeUndefined();
  expect(log.mock.calls).toEqual([["AGENT_AUDIT_WRITE_FAILED"], ["AGENT_AUDIT_WRITE_FAILED"]]); log.mockRestore();
});
it("app mutation capabilities always throw", () => {
  expect(() => auditMutations.update()).toThrow("AGENT_AUDIT_APPEND_ONLY");
  expect(() => auditMutations.delete()).toThrow("AGENT_AUDIT_APPEND_ONLY");
});
it.each([{}, { authorization: "Bearer synthetic-token" }, { "x-api-key": "synthetic-key" }])("requires an admin session before reading filters (%j)", async headers => {
  state.admin.mockRejectedValue(new DomainError("Access denied.", 403));
  const response = await GET(new Request("http://localhost/api/admin/audit?bookingId=private", { headers: headers as HeadersInit }));
  expect(response.status).toBe(403); expect(await response.text()).not.toContain("private");
});
const mandate = { businessId: "demo", clientId: "c", serviceId: "s", staffId: "a", validFrom: "2030-01-01T10:00:00Z", validUntil: "2030-01-01T11:00:00Z", expiresAt: "2030-01-01T09:00:00Z", maxPriceOre: 100, currency: "SEK", origin: "synthetic-operator", originReference: "test" };
it.each(["paymentToken", "payment", "checkout", "charge", "card", "paymentIntent", "checkoutSession", "chargeId"])("rejects %s on mandate and related payloads", field => {
  expect(mandateSchema.safeParse({ ...mandate, [field]: "forbidden" }).success).toBe(false);
  const proposal = { business: "demo", serviceId: "s", serviceVersion: 1, staffId: "a", start: "2030-01-01T10:00:00Z" };
  expect(proposalSchema.safeParse({ ...proposal, [field]: "forbidden" }).success).toBe(false);
  expect(agentBookingSchema.safeParse({ ...proposal, confirmed: true, customer: { name: "Synthetic Test", email: "test@example.test" }, [field]: "forbidden" }).success).toBe(false);
});
it("payment contract is a separate reference, with no issuance capability", () => {
  const future: PaymentAuthorizationToken = { mandateId: "existing-mandate", purpose: "payment-authorization" };
  expect(Object.keys(future).sort()).toEqual(["mandateId", "purpose"]);
  const compileBoundary = (m: StoredMandate) => {
    // @ts-expect-error Payment authorization is never a mandate field.
    m.paymentToken = future;
  };
  void compileBoundary;
  expect(mandateSchema.safeParse(mandate).success).toBe(true);
});
