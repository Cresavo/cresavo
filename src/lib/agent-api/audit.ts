import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "../db";

const context = new AsyncLocalStorage<string>();
const id = z.string().regex(/^[A-Za-z0-9_:-]{1,160}$/);
const schema = z.object({
  businessId: z.enum(["demo", "lab-partner"]).default("demo"),
  event: z.enum(["oauth.client_registered", "oauth.register_denied", "oauth.authorize_granted", "oauth.authorize_denied", "oauth.token_issued", "oauth.token_denied", "agent.request", "email_code.sent", "email_code.verified", "email_code.denied", "proposal.created", "proposal.viewed", "proposal.expired", "consent.approved", "consent.declined", "mandate.created", "mandate.consumed", "mandate.expired", "booking.created", "booking.cancelled"]),
  outcome: z.string().regex(/^[a-z0-9_:-]{1,64}$/),
  clientId: id.optional(), keyId: id.optional(),
  scopes: z.array(z.enum(["services:read", "availability:read", "bookings:read", "bookings:write"])).default([]),
  route: z.string().regex(/^[A-Za-z0-9 /:{}._-]{1,160}$/).optional(),
  tool: z.string().regex(/^[a-z_]{1,64}$/).optional(),
  requestId: z.string().uuid(), proposalId: id.optional(), mandateId: id.optional(), bookingId: id.optional(),
}).strict();
export type AuditInput = Omit<z.input<typeof schema>, "requestId" | "scopes"> & { scopes?: string[] };
/** Always server-generated: incoming correlation headers may contain credentials. */
export function auditContext<T>(run: () => T): T { return context.run(randomUUID(), run); }
/** Strict append used when the caller must atomically commit link and audit. */
export async function recordAuditInTransaction(tx: Prisma.TransactionClient, input: AuditInput) {
  const data = schema.parse({ ...input, requestId: context.getStore() ?? randomUUID() });
  await tx.agentAuditEvent.create({ data });
}
/** The only insert capability. Explicit schema prevents accidental payload logging. */
export async function recordAudit(input: AuditInput) {
  try {
    await recordAuditInTransaction(db, input);
  } catch { console.error("AGENT_AUDIT_WRITE_FAILED"); }
}
export const auditMutations = Object.freeze({
  update(): never { throw new Error("AGENT_AUDIT_APPEND_ONLY"); },
  delete(): never { throw new Error("AGENT_AUDIT_APPEND_ONLY"); },
});
