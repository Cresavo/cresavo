import { randomUUID } from "node:crypto";
import { auditContext, recordAudit, recordAuditInTransaction } from "./audit";
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
import { codeHash, codeResendSeconds, codeTtlSeconds, EMAIL_CODE_CHANNEL, MAX_CODE_ATTEMPTS, MAX_CODE_SENDS, newCode,
  simulatedEmailCodeSender, syntheticContactEmail, type EmailCodeSender } from "./email-code-consent";
import { business } from "./v1";
import { requireConsentLab } from "./customer-identity";

const id = z.string().trim().min(1).max(128);
export const proposalSchema = z.object({
  business: id, serviceId: id, serviceVersion: z.number().int().positive(),
  staffId: id, start: z.iso.datetime({ offset: true }),
}).strict();
export const proposalHash = (p: AgentProposal) => bookingProposalHash({ ...p, start: p.startsAt });
const status = (p: AgentProposal, now: Date) => p.status === "pending" && +p.expiresAt <= +now ? "expired" : p.status;
export function proposalView(p: AgentProposal, now: Date) {
  return { id: p.id, status: status(p, now), serviceId: p.serviceId, serviceVersion: p.serviceVersion,
    serviceName: p.serviceName, staff: { id: p.staffId, name: p.staffName },
    locationId: p.locationId, scheduleId: p.scheduleId, salon: "Salong Eko (syntetisk demo)",
    start: p.startsAt.toISOString(), durationMinutes: p.duration, price: { amountMinor: p.priceOre, currency: "SEK" },
    expiresAt: p.expiresAt.toISOString(), ...(p.status === "approved" ? { mandateId: p.mandateId } : {}) };
}
const view = proposalView;
// The consent page link carries no secret: approving needs the code sent to the customer's own address.
const consentUrl = (proposalId: string) => `${requireConsentLab()}/consent/${proposalId}`;

export async function createProposal(p: AgentPrincipal, body: unknown, now = new Date()) {
  requireConsentLab();
  if (!p.scopes.includes("bookings:write")) throw new AgentApiError("forbidden_scope");
  const input = proposalSchema.parse(body);
  business(p, input.business);
  const ttl = Number(process.env.BOOKING_CONSENT_TTL_SECONDS ?? 600);
  if (!Number.isInteger(ttl) || ttl < 1 || ttl > 900) throw new AgentApiError("invalid_request");
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
    return tx.agentProposal.create({ data: { id: randomUUID(), consentDelivery: EMAIL_CODE_CHANNEL,
      businessId: p.businessId, clientId: p.clientId,
      serviceId: service.id, serviceVersion: service.version, serviceName: service.name,
      staffId: staff.id, staffName: staff.name, ...placeForStaff(staff.id), startsAt: start,
      duration: service.duration, priceOre: service.priceOre, proposalHash: bookingProposalHash(snapshot),
      expiresAt: new Date(Math.min(+now + ttl * 1000, +start)) } });
  });
  await recordAudit({ event: "proposal.created", outcome: "pending", proposalId: row.id, clientId: row.clientId, businessId: row.businessId as "demo" | "lab-partner" });
  console.info(JSON.stringify({ event: "customer_proposal", outcome: "pending" }));
  return { proposal: view(row, now), approvalRequired: true, approvalDelivery: "customer-email-code", consentUrl: consentUrl(row.id) };
}

export async function getProposal(p: AgentPrincipal, proposalId: string, now = new Date()) {
  if (!p.scopes.some(s => s === "bookings:read" || s === "bookings:write")) throw new AgentApiError("forbidden_scope");
  const row = await db.agentProposal.findFirst({ where: { id: proposalId, businessId: p.businessId, clientId: p.clientId } });
  if (!row) throw new AgentApiError("booking_not_found");
  const proposal = view(row, now);
  if (row.consentDelivery === EMAIL_CODE_CHANNEL && proposal.status === "pending") return { proposal, consentUrl: consentUrl(row.id) };
  return { proposal };
}

export const customerDecisionSchema = z.object({
  decision: z.enum(["view", "send-code", "yes", "no"]),
  proposalHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  code: z.string().max(32).optional(),
  email: z.string().max(254).optional(),
}).strict();

async function customerDecisionInternal(proposalId: string, body: unknown, now?: Date, emailSender: EmailCodeSender = simulatedEmailCodeSender) {
  requireConsentLab();
  const input = customerDecisionSchema.parse(body);
  let auditRow: AgentProposal | undefined;
  let approvedMandate: string | undefined;
  let expired = false;
  let result;
  try { result = await db.$transaction(async tx => {
    const rows = await tx.$queryRaw<AgentProposal[]>`SELECT * FROM "AgentProposal" WHERE "id"=${proposalId} AND "consentDelivery"=${EMAIL_CODE_CHANNEL} FOR UPDATE`;
    const row = rows[0];
    const decisionTime = now ?? new Date();
    if (row) { auditRow = row; expired = status(row, decisionTime) === "expired"; }
    if (!row || status(row, decisionTime) !== "pending" || row.proposalHash !== proposalHash(row))
      throw new AgentApiError("mandate_denied");
    if (input.decision === "view")
      return { proposal: { ...view(row, decisionTime), emailCodeRequired: true, contactEmailMask: row.contactEmailMask }, proposalHash: row.proposalHash };
    const owner = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "AgentClient" WHERE "id"=${row.clientId} AND "businessId"=${row.businessId} AND "active"=true FOR SHARE`;
    if (!owner.length || +row.expiresAt <= +decisionTime) throw new AgentApiError("mandate_denied");
    const audit = (event: "email_code.sent" | "email_code.denied" | "email_code.verified", outcome: string) => recordAuditInTransaction(tx, {
      event, outcome, proposalId: row.id, clientId: row.clientId, businessId: row.businessId as "demo" | "lab-partner",
    });
    if (input.decision === "send-code") {
      const contact = syntheticContactEmail(input.email);
      if (row.otpSends >= MAX_CODE_SENDS || (row.otpLastSentAt && +decisionTime - +row.otpLastSentAt < codeResendSeconds() * 1000)) {
        await audit("email_code.denied", "rate_limited");
        return { denied: "rate_limited" as const };
      }
      const code = newCode(row.id, row.otpHash);
      await tx.agentProposal.update({ where: { id: row.id }, data: { ...contact, otpHash: code.hash,
        otpExpiresAt: new Date(+decisionTime + codeTtlSeconds() * 1000), otpAttempts: 0, otpLastSentAt: decisionTime, otpSends: row.otpSends + 1 } });
      await audit("email_code.sent", "success");
      emailSender.send({ proposalId: row.id, ...contact, code: code.code });
      return { status: "sent", contactEmailMask: contact.contactEmailMask };
    }
    if (input.proposalHash !== row.proposalHash) throw new AgentApiError("mandate_denied");
    // Either answer needs the code: the link alone decides nothing.
    if (row.otpAttempts >= MAX_CODE_ATTEMPTS || !row.contactEmailHash || !row.otpExpiresAt || +row.otpExpiresAt <= +decisionTime ||
        !input.code || !/^[0-9]{6}$/.test(input.code) || codeHash(row.id, input.code) !== row.otpHash) {
      await tx.agentProposal.update({ where: { id: row.id }, data: { otpAttempts: Math.min(MAX_CODE_ATTEMPTS, row.otpAttempts + 1) } });
      await audit("email_code.denied", "mandate_denied");
      // Commit the failed attempt before raising the public error outside the transaction.
      return { denied: "mandate_denied" as const };
    }
    await tx.agentProposal.update({ where: { id: row.id }, data: { otpVerifiedAt: decisionTime } });
    await audit("email_code.verified", "success");
    let mandateId: string | null = null;
    if (input.decision === "yes") {
      const mandate = await tx.agentMandate.create({ data: {
        businessId: row.businessId, clientId: row.clientId, serviceId: row.serviceId, staffId: row.staffId,
        locationId: row.locationId, scheduleId: row.scheduleId,
        validFrom: row.startsAt, validUntil: new Date(+row.startsAt + row.duration * 60000),
        expiresAt: row.expiresAt, maxPriceOre: row.priceOre, currency: "SEK", verifiedVia: EMAIL_CODE_CHANNEL,
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
  if ("denied" in result && result.denied) throw new AgentApiError(result.denied);
  if (input.decision === "send-code") return result;
  if (auditRow) {
    const detail = { proposalId: auditRow.id, clientId: auditRow.clientId, businessId: auditRow.businessId as "demo" | "lab-partner", mandateId: approvedMandate };
    await recordAudit({ ...detail, event: input.decision === "view" ? "proposal.viewed" : input.decision === "yes" ? "consent.approved" : "consent.declined", outcome: "success" });
    if (approvedMandate) await recordAudit({ ...detail, event: "mandate.created", outcome: "customer-consent" });
  }
  console.info(JSON.stringify({ event: "customer_consent", outcome: input.decision === "view" ? "view" : result.status }));
  return result;
}

export const customerDecision: typeof customerDecisionInternal = (...args) => auditContext(() => customerDecisionInternal(...args));
