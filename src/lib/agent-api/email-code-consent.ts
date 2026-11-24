// Email one-time code on the consent page (ADR 7). The consent link carries no secret: the customer
// types their own address, receives a six-digit code there and approves with it. The mandate is
// bound to that address, so an agent can only book in the name of someone who read the code.
// Lab profile: synthetic @example.test addresses and a process-local inbox, never a real e-mail.
import { createHash } from "node:crypto";
import { AgentApiError } from "./errors";
import { requireConsentLab } from "./customer-identity";

export const EMAIL_CODE_CHANNEL = "email-code-v1";
export const MAX_CODE_SENDS = 5;

export function emailCodeConsent() {
  if (process.env.BOOKING_CONSENT_DELIVERY !== "email-code") return false;
  requireConsentLab();
  if (process.env.BOOKING_RUNTIME !== "local" || process.env.VERCEL || process.env.VERCEL_ENV ||
      process.env.VERCEL_URL || process.env.BOOKING_SMS_OTP_LAB === "1")
    throw new AgentApiError("mandate_denied");
  return true;
}

const SYNTHETIC_EMAIL = /^[a-z0-9][a-z0-9._+-]{0,63}@example\.test$/;
export const contactEmailHash = (email: string) =>
  createHash("sha256").update(`consent-email-v1:${email.trim().toLowerCase()}`).digest("hex");

/** The digest and mask of a synthetic address; anything else is refused. */
export function syntheticContactEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!SYNTHETIC_EMAIL.test(email)) throw new AgentApiError("synthetic_contact_required");
  return { contactEmailHash: contactEmailHash(email), contactEmailMask: `${email[0]}***@example.test` };
}

/** At booking: the customer's address must be the one that received and returned the code. */
export function assertEmailCodeBinding(
  proposal: { consentDelivery: string | null; contactEmailHash?: string | null; otpVerifiedAt?: Date | null },
  mandate: { verifiedVia: string | null },
  customer: { email: string },
) {
  if (proposal.consentDelivery !== EMAIL_CODE_CHANNEL || mandate.verifiedVia !== EMAIL_CODE_CHANNEL ||
      !proposal.contactEmailHash || !proposal.otpVerifiedAt || contactEmailHash(customer.email) !== proposal.contactEmailHash)
    throw new AgentApiError("mandate_denied");
}

export type EmailCodeMessage = Readonly<{ proposalId: string; contactEmailHash: string; contactEmailMask: string; code: string }>;
export interface EmailCodeSender { send(message: EmailCodeMessage): void }
export class SimulatedEmailCodeSender implements EmailCodeSender {
  private readonly messages: EmailCodeMessage[] = [];
  send(message: EmailCodeMessage) {
    requireConsentLab();
    this.messages.push(Object.freeze({ ...message }));
    if (this.messages.length > 1000) this.messages.shift();
  }
  read(): readonly EmailCodeMessage[] { requireConsentLab(); return this.messages.slice(); }
  clear() { this.messages.length = 0; }
}
// Process-local lab inbox: never exported through HTTP/MCP or ordinary logs.
export const simulatedEmailCodeSender = new SimulatedEmailCodeSender();
