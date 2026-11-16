import { randomUUID } from "node:crypto";
import { newOtp, otpHash, otpTtlSeconds, otpResendSeconds, simulatedSmsSender, smsOtpRequired, syntheticPhone, type SmsSender } from "./sms-otp";
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
import { business } from "./v1";
import { labCustomerIdentity, requireConsentLab } from "./customer-identity";
import { CHANNEL_CUSTOMER, CUSTOMER_CHANNEL, prepareCustomerDelivery, separateCustomerChannel } from "./customer-channel-lab";

const id = z.string().trim().min(1).max(128);
export const proposalSchema = z.object({
  business: id, serviceId: id, serviceVersion: z.number().int().positive(),
  staffId: id, start: z.iso.datetime({ offset: true }),
  customerPhone: z.string().max(32).optional(),
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
type ProposalResult = { proposal: ReturnType<typeof view>; approvalUrl?: string; approvalRequired?: boolean; approvalDelivery?: string };
export async function createProposal(p: AgentPrincipal, body: unknown, now = new Date(), smsSender: SmsSender = simulatedSmsSender): Promise<ProposalResult> {
  requireConsentLab();
  if (!p.scopes.includes("bookings:write")) throw new AgentApiError("forbidden_scope");
  const input = proposalSchema.parse(body);
  business(p, input.business);
  const delivery = prepareCustomerDelivery();
  const required = smsOtpRequired(p.businessId);
  if (!required && input.customerPhone !== undefined) throw new AgentApiError("invalid_request");
  const phone = required ? syntheticPhone(input.customerPhone) : null;
  const proposalId = randomUUID();
  const otp = required ? newOtp(proposalId) : null;
  const otpTtl = required ? otpTtlSeconds() : 0;
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
    return tx.agentProposal.create({ data: { id: proposalId, smsOtpRequired: required,
      consentDelivery: delivery?.channel ?? null,
      ...(phone && otp ? { ...phone, otpHash: otp.hash, otpExpiresAt: new Date(+now + otpTtl * 1000), otpLastSentAt: now } : {}),
      businessId: p.businessId, clientId: p.clientId,
      serviceId: service.id, serviceVersion: service.version, serviceName: service.name,
      staffId: staff.id, staffName: staff.name, ...placeForStaff(staff.id), startsAt: start,
      duration: service.duration, priceOre: service.priceOre, proposalHash: bookingProposalHash(snapshot),
      tokenHash: digest, expiresAt: new Date(Math.min(+now + ttl * 1000, +start)) } });
  });
  await recordAudit({ event: "proposal.created", outcome: "pending", proposalId: row.id, clientId: row.clientId, businessId: row.businessId as "demo" | "lab-partner" });
  if (phone && otp) {
    smsSender.send({ proposalId: row.id, ...phone, code: otp.code });
    await recordAudit({ event: "sms_otp.sent", outcome: "success", proposalId: row.id, clientId: row.clientId, businessId: row.businessId as "demo" | "lab-partner" });
  }
  console.info(JSON.stringify({ event: "customer_proposal", outcome: "pending" }));
  if (delivery) {
    delivery.send(row.id, token);
    return { proposal: view(row, now), approvalRequired: true, approvalDelivery: "separate-synthetic-customer" };
  }
  return { proposal: view(row, now), ...labCustomerIdentity.deliver(row.id, token) };
}
export async function getProposal(p: AgentPrincipal, proposalId: string, now = new Date()) {
  if (!p.scopes.some(s => s === "bookings:read" || s === "bookings:write")) throw new AgentApiError("forbidden_scope");
  const row = await db.agentProposal.findFirst({ where: { id: proposalId, businessId: p.businessId, clientId: p.clientId } });
  if (!row) throw new AgentApiError("booking_not_found");
  return { proposal: view(row, now) };
}
export const customerDecisionSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/), decision: z.enum(["view", "yes", "no", "resend"]),
  proposalHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  code: z.string().max(32).optional(),
}).strict();
async function customerDecisionInternal(proposalId: string, body: unknown, now?: Date, smsSender: SmsSender = simulatedSmsSender) {
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
    if ((row.consentDelivery !== null && row.consentDelivery !== CUSTOMER_CHANNEL) ||
        (separateCustomerChannel() && row.consentDelivery !== CUSTOMER_CHANNEL))
      throw new AgentApiError("mandate_denied");
    if (input.decision === "view") return { proposal: { ...view(row, decisionTime), ...(row.smsOtpRequired ? { smsOtpRequired: true, phoneMask: row.phoneMask } : {}) }, proposalHash: row.proposalHash,
      customer: row.consentDelivery === CUSTOMER_CHANNEL ? `${CHANNEL_CUSTOMER.name} · ${CHANNEL_CUSTOMER.email}` : labCustomerIdentity.displayName };
    const owner = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "AgentClient" WHERE "id"=${row.clientId} AND "businessId"=${row.businessId} AND "active"=true FOR SHARE`;
    if (!owner.length || +row.expiresAt <= +(now ?? new Date())) throw new AgentApiError("mandate_denied");
    const smsAudit = (event: "sms_otp.resent" | "sms_otp.denied" | "sms_otp.verified", outcome: string) => recordAuditInTransaction(tx, {
      event, outcome, proposalId: row.id, clientId: row.clientId, businessId: row.businessId as "demo" | "lab-partner",
    });
    if (input.decision === "resend") {
      if (!row.smsOtpRequired || !row.phoneHash || !row.phoneMask) throw new AgentApiError("mandate_denied");
      if (!row.otpLastSentAt || +decisionTime - +row.otpLastSentAt < otpResendSeconds() * 1000) {
        await smsAudit("sms_otp.denied", "rate_limited");
        return { denied: "rate_limited" as const };
      }
      const otp = newOtp(row.id, row.otpHash);
      await tx.agentProposal.update({ where: { id: row.id }, data: {
        otpHash: otp.hash, otpExpiresAt: new Date(+decisionTime + otpTtlSeconds() * 1000), otpAttempts: 0, otpLastSentAt: decisionTime,
      } });
      await smsAudit("sms_otp.resent", "success");
      smsSender.send({ proposalId: row.id, phoneHash: row.phoneHash, phoneMask: row.phoneMask, code: otp.code });
      return { status: "resent" };
    }
    if (input.proposalHash !== row.proposalHash) throw new AgentApiError("mandate_denied");
    let mandateId: string | null = null;
    if (input.decision === "yes") {
      if (row.smsOtpRequired) {
        if (row.otpAttempts >= 5 || !row.otpExpiresAt || +row.otpExpiresAt <= +decisionTime ||
            !input.code || !/^[0-9]{6}$/.test(input.code) || otpHash(row.id, input.code) !== row.otpHash) {
          await tx.agentProposal.update({ where: { id: row.id }, data: { otpAttempts: Math.min(5, row.otpAttempts + 1) } });
          await smsAudit("sms_otp.denied", "mandate_denied");
          // Commit the failed attempt before raising the public error outside the transaction.
          return { denied: "mandate_denied" as const };
        }
        await tx.agentProposal.update({ where: { id: row.id }, data: { otpVerifiedAt: decisionTime } });
        await smsAudit("sms_otp.verified", "success");
      }
      const mandate = await tx.agentMandate.create({ data: {
        businessId: row.businessId, clientId: row.clientId, serviceId: row.serviceId, staffId: row.staffId,
        locationId: row.locationId, scheduleId: row.scheduleId,
        validFrom: row.startsAt, validUntil: new Date(+row.startsAt + row.duration * 60000),
        expiresAt: row.expiresAt, maxPriceOre: row.priceOre, currency: "SEK",
        verifiedVia: row.consentDelivery === CUSTOMER_CHANNEL ? CUSTOMER_CHANNEL : row.smsOtpRequired ? "sms-otp" : null,
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
  if (input.decision === "resend") return result;
  if (auditRow) {
    const detail = { proposalId: auditRow.id, clientId: auditRow.clientId, businessId: auditRow.businessId as "demo" | "lab-partner", mandateId: approvedMandate };
    await recordAudit({ ...detail, event: input.decision === "view" ? "proposal.viewed" : input.decision === "yes" ? "consent.approved" : "consent.declined", outcome: "success" });
    if (approvedMandate) await recordAudit({ ...detail, event: "mandate.created", outcome: "customer-consent" });
  }
  console.info(JSON.stringify({ event: "customer_consent", outcome: input.decision === "view" ? "view" : result.status }));
  return result;
}

export const customerDecision: typeof customerDecisionInternal = (...args) => auditContext(() => customerDecisionInternal(...args));
