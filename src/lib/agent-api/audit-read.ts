import { z } from "zod";
import { db } from "../db";
const id = z.string().regex(/^[A-Za-z0-9_:-]{1,160}$/);
export const auditQuery = z.object({
  businessId: z.enum(["demo", "lab-partner"]).default("demo"),
  proposalId: id.optional(), mandateId: id.optional(), bookingId: id.optional(),
  requestId: z.string().uuid().optional(), clientId: id.optional(),
  from: z.iso.datetime().optional(), to: z.iso.datetime().optional(),
  after: id.optional(), chain: z.enum(["true"]).optional(),
}).strict().refine(q => !q.chain || !!(q.proposalId || q.mandateId || q.bookingId));
/** Caller must enforce admin authentication before parsing or reading. */
export async function readAudit(input: unknown) {
  const q = auditQuery.parse(input);
  let proposalId = q.proposalId, mandateId = q.mandateId;
  const bookingId = q.bookingId;
  if (q.chain) {
    if (bookingId) {
      const link = await db.agentBooking.findFirst({ where: { bookingId, businessId: q.businessId } });
      mandateId = link?.mandateId ?? mandateId;
    }
    if (mandateId) {
      const mandate = await db.agentMandate.findFirst({ where: { id: mandateId, businessId: q.businessId } });
      if (mandate?.origin === "customer-consent") proposalId = mandate.originReference;
    }
    if (proposalId) {
      const proposal = await db.agentProposal.findFirst({ where: { id: proposalId, businessId: q.businessId } });
      mandateId = proposal?.mandateId ?? mandateId;
    }
  }
  const correlations = { proposalId, mandateId, bookingId };
  const rows = await db.agentAuditEvent.findMany({
    where: { businessId: q.businessId, ...(q.chain ? { OR: Object.entries(correlations).filter(([,v]) => v).map(([k,v]) => ({ [k]: v })) } : { ...correlations, clientId: q.clientId, requestId: q.requestId }),
      createdAt: { gte: q.from ? new Date(q.from) : undefined, lte: q.to ? new Date(q.to) : undefined } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 201,
    ...(q.after ? { cursor: { id: q.after }, skip: 1 } : {}),
  });
  return { events: rows.slice(0, 200), nextCursor: rows.length > 200 ? rows[199].id : null };
}
