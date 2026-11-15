import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ find: vi.fn(), link: vi.fn(), mandate: vi.fn(), proposal: vi.fn() }));
vi.mock("../src/lib/db", () => ({ db: {
  agentAuditEvent: { findMany: mocks.find }, agentBooking: { findFirst: mocks.link },
  agentMandate: { findFirst: mocks.mandate }, agentProposal: { findFirst: mocks.proposal },
} }));
import { readAudit } from "../src/lib/agent-api/audit-read";
beforeEach(() => {
  mocks.find.mockReset().mockResolvedValue([]);
  mocks.link.mockResolvedValue({ mandateId: "mandate-1" });
  mocks.mandate.mockResolvedValue({ origin: "customer-consent", originReference: "proposal-1" });
  mocks.proposal.mockResolvedValue({ mandateId: "mandate-1" });
});
it.each([{ bookingId: "booking-1" }, { mandateId: "mandate-1" }, { proposalId: "proposal-1" }])("resolves stored links from %j with deterministic ordering", async input => {
  await readAudit({ ...input, chain: "true" });
  const query = mocks.find.mock.calls[0][0];
  expect(query.where.businessId).toBe("demo");
  expect(query.where.OR).toEqual(expect.arrayContaining([{ proposalId: "proposal-1" }, { mandateId: "mandate-1" }]));
  expect(query.orderBy).toEqual([{ createdAt: "asc" }, { id: "asc" }]);
});
it("bounds pages and supplies an explicit continuation cursor", async () => {
  mocks.find.mockResolvedValue(Array.from({ length: 201 }, (_, i) => ({ id: `row-${i}` })));
  const result = await readAudit({ clientId: "client-1" });
  expect(result.events).toHaveLength(200); expect(result.nextCursor).toBe("row-199");
  await readAudit({ clientId: "client-1", after: result.nextCursor! });
  expect(mocks.find.mock.calls[1][0]).toMatchObject({ cursor: { id: "row-199" }, skip: 1 });
});
it.each([{ chain: "true" }, { access_token: "secret" }, { requestId: "token" }])("rejects unbounded or unknown input %j", async input => {
  await expect(readAudit(input)).rejects.toBeDefined(); expect(mocks.find).not.toHaveBeenCalled();
});
