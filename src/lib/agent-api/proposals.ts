import { auditContext, recordAudit } from "./audit";
import { z } from "zod";
import type { AgentProposal } from "@prisma/client";
import { getBookingProvider } from "./provider";
import { db } from "../db";
import { lockConfiguration } from "../workspace-write";
import type { AgentPrincipal } from "./keys";
import { AgentApiError } from "./errors";
import { assertCurrentAgent } from "./mandates";
import { bookingProposalHash } from "./mandate-policy";
import { placeForStaff } from "./place";
import { business } from "./v1";
import { labCustomerIdentity, requireConsentLab } from "./customer-identity";

const id = z.string().trim().min(1).max(128);
export const proposalSchema = z.object({
  business: id, serviceId: id, serviceVersion: z.number().int().positive(),
  staffId: id, start: z.iso.datetime({ offset: true }),
}).strict();
export const proposalHash = (p: AgentProposal) => bookingProposalHash({ ...p, start: p.startsAt });
const status = (p: AgentProposal, now: Date) => p.status === "pending" && +p.expiresAt <= +now ? "expired" : p.status;
function view(p: AgentProposal, now: Date) {
  return { id: p.id, status: status(p, now), serviceId: p.serviceId, serviceVersion: p.serviceVersion,
    serviceName: p.serviceName, staff: { id: p.staffId, name: p.staffName },
    locationId: p.locationId, scheduleId: p.scheduleId, salon: "Salong Eko (syntetisk demo)",
    start: p.startsAt.toISOString(), durationMinutes: p.duration, price: { amountMinor: p.priceOre, currency: "SEK" },
    expiresAt: p.expiresAt.toISOString(), ...(p.status === "approved" ? { mandateId: p.mandateId } : {}) };
}
export async function createProposal(p: AgentPrincipal, body: unknown, now = new Date()) {
  requireConsentLab();
  if (!p.scopes.includes("bookings:write")) throw new AgentApiError("forbidden_scope");
  const input = proposalSchema.parse(body);
  business(p, input.business);
  const ttl = Number(process.env.BOOKING_CONSENT_TTL_SECONDS ?? 600);
  if (!Number.isInteger(ttl) || ttl < 1 || ttl > 900) throw new AgentApiError("invalid_request");
  const { token, digest } = labCustomerIdentity.issueCredential();
  const provider = getBookingProvider(p.businessId);
  const catalog = provider.id === "native" ? null : await provider.listServices();
  const row = await db.$transaction(async tx => {
    await lockConfiguration(tx);
    await assertCurrentAgent(tx, p);
    const service = catalog ? catalog.services.find(s => s.id === input.serviceId) : await tx.service.findFirst({ where: { id: input.serviceId, businessId: p.businessId, active: true } });
    if (!service) throw new AgentApiError("service_not_found");
    if (service.version !== input.serviceVersion) throw new AgentApiError("stale_service");
    const staff = catalog ? catalog.resources.find(s => s.id === input.staffId) : await tx.staff.findFirst({ where: { id: input.staffId, businessId: p.businessId, active: true } });
    if (!staff?.serviceIds.includes(service.id)) throw new AgentApiError("staff_not_found");
    const start = new Date(input.start);
    if (+start <= +now) throw new AgentApiError("invalid_request");
    const snapshot = { businessId: p.businessId, clientId: p.clientId, serviceId: service.id,
      staffId: staff.id, ...placeForStaff(staff.id), start, duration: service.duration, priceOre: service.priceOre };
    return tx.agentProposal.create({ data: { businessId: p.businessId, clientId: p.clientId,
      serviceId: service.id, serviceVersion: service.version, serviceName: service.name,
      staffId: staff.id, staffName: staff.name, ...placeForStaff(staff.id), startsAt: start,
      duration: service.duration, priceOre: service.priceOre, proposalHash: bookingProposalHash(snapshot),
      tokenHash: digest, expiresAt: new Date(Math.min(+now + ttl * 1000, +start)) } });
  });
  await recordAudit({ event: "proposal.created", outcome: "pending", proposalId: row.id, clientId: row.clientId, businessId: row.businessId as "demo" | "lab-partner" });
  console.info(JSON.stringify({ event: "customer_proposal", outcome: "pending" }));
  return { proposal: view(row, now), ...labCustomerIdentity.deliver(row.id, token) };
}
export async function getProposal(p: AgentPrincipal, proposalId: string, now = new Date()) {
  if (!p.scopes.some(s => s === "bookings:read" || s === "bookings:write")) throw new AgentApiError("forbidden_scope");
  const row = await db.agentProposal.findFirst({ where: { id: proposalId, businessId: p.businessId, clientId: p.clientId } });
  if (!row) throw new AgentApiError("booking_not_found");
  return { proposal: view(row, now) };
}
export const customerDecisionSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/), decision: z.enum(["view", "yes", "no"]),
  proposalHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).strict();
async function customerDecisionInternal(proposalId: string, body: unknown, now?: Date) {
  requireConsentLab();
  const input = customerDecisionSchema.parse(body);
  let auditRow: AgentProposal | undefined;
  let approvedMandate: string | undefined;
  let expired = false;
  let result;
  try { result = await db.$transaction(async tx => {
    const rows = await tx.$queryRaw<AgentProposal[]>`SELECT * FROM "AgentProposal" WHERE "id"=${proposalId} AND "tokenHash"=${labCustomerIdentity.credentialDigest(input.token)} FOR UPDATE`;
    const row = rows[0];
    const decisionTime = now ?? new Date();
    if (row) { auditRow = row; expired = status(row, decisionTime) === "expired"; }
    if (!row || status(row, decisionTime) !== "pending" || row.proposalHash !== proposalHash(row))
      throw new AgentApiError("mandate_denied");
    if (input.decision === "view") return { proposal: view(row, decisionTime), proposalHash: row.proposalHash, customer: labCustomerIdentity.displayName };
    if (input.proposalHash !== row.proposalHash) throw new AgentApiError("mandate_denied");
    const owner = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "AgentClient" WHERE "id"=${row.clientId} AND "businessId"=${row.businessId} AND "active"=true FOR SHARE`;
    if (!owner.length || +row.expiresAt <= +(now ?? new Date())) throw new AgentApiError("mandate_denied");
    let mandateId: string | null = null;
    if (input.decision === "yes") {
      const mandate = await tx.agentMandate.create({ data: {
        businessId: row.businessId, clientId: row.clientId, serviceId: row.serviceId, staffId: row.staffId,
        locationId: row.locationId, scheduleId: row.scheduleId,
        validFrom: row.startsAt, validUntil: new Date(+row.startsAt + row.duration * 60000),
        expiresAt: row.expiresAt, maxPriceOre: row.priceOre, currency: "SEK",
        origin: "customer-consent", originReference: row.id, proposalHash: row.proposalHash,
      } });
      mandateId = mandate.id; approvedMandate = mandate.id;
    }
    await tx.agentProposal.update({ where: { id: row.id }, data: { status: input.decision === "yes" ? "approved" : "declined", mandateId } });
    return { status: input.decision === "yes" ? "approved" : "declined" };
  });
  } catch (error) {
    if (expired && auditRow) await recordAudit({ businessId: auditRow.businessId as "demo" | "lab-partner", event: "proposal.expired", outcome: "expired", proposalId: auditRow.id, clientId: auditRow.clientId });
    throw error;
  }
  if (auditRow) {
    const detail = { proposalId: auditRow.id, clientId: auditRow.clientId, businessId: auditRow.businessId as "demo" | "lab-partner", mandateId: approvedMandate };
    await recordAudit({ ...detail, event: input.decision === "view" ? "proposal.viewed" : input.decision === "yes" ? "consent.approved" : "consent.declined", outcome: "success" });
    if (approvedMandate) await recordAudit({ ...detail, event: "mandate.created", outcome: "customer-consent" });
  }
  console.info(JSON.stringify({ event: "customer_consent", outcome: input.decision === "view" ? "view" : result.status }));
  return result;
}

export const customerDecision: typeof customerDecisionInternal = (...args) => auditContext(() => customerDecisionInternal(...args));
