// Split-mode staging customer channel. The salon selects one fixed fictional
// recipient and stores the approval link in a private database inbox that only the
// test operator reads. This is not real customer authentication or delivery.
import type { Prisma } from "@prisma/client";
import { stagingConsentPolicy } from "../../../scripts/consent-channel-policy.mjs";
import { AgentApiError } from "./errors";

export const STAGING_CHANNEL = "separate-staging-v1";
export const STAGING_APPROVAL_DELIVERY = "separate-staging-customer";
// Server-owned binding. Agent JSON can neither choose nor replace this recipient.
export const STAGING_CUSTOMER = Object.freeze({
  id: "staging-customer-v1", name: "Staging Demo Customer", email: "staging-customer@example.test",
});

/** The configured HTTPS consent origin, or null when the staging channel is off. */
export function stagingConsentOrigin(env: Record<string, string | undefined> = process.env): string | null {
  try { return stagingConsentPolicy(env); }
  catch { throw new AgentApiError("mandate_denied"); }
}

export function requireStagingConsent(env: Record<string, string | undefined> = process.env) {
  const origin = stagingConsentOrigin(env);
  if (!origin) throw new AgentApiError("mandate_denied");
  return origin;
}

/** Same shape as the lab link. The secret is in the fragment, so browsers never send it. */
export function stagingApprovalLink(origin: string, proposalId: string, token: string) {
  if (!/^[a-f0-9-]{36}$/.test(proposalId) || !/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new AgentApiError("invalid_request");
  return `${origin}/consent/${proposalId}#${token}`;
}

export const stagingInbox = {
  /** Runs inside the proposal transaction: a failed delivery leaves no proposal behind. */
  async deliver(tx: Prisma.TransactionClient, origin: string, proposalId: string, token: string) {
    await tx.consentInboxMessage.create({ data: {
      proposalId, recipientId: STAGING_CUSTOMER.id, approvalLink: stagingApprovalLink(origin, proposalId, token),
    } });
  },
  /** Marks the one message for this proposal as used; refuses a missing or already used message. */
  async consume(tx: Prisma.TransactionClient, proposalId: string, at: Date) {
    const { count } = await tx.consentInboxMessage.updateMany({
      where: { proposalId, recipientId: STAGING_CUSTOMER.id, consumedAt: null }, data: { consumedAt: at },
    });
    if (count !== 1) throw new AgentApiError("mandate_denied");
  },
};

/** A valid link whose proposal is no longer pending. Shown to the link holder; grants nothing. */
export class ConsentLinkState extends Error {
  constructor(readonly state: "used" | "expired") { super("CONSENT_LINK_STATE"); }
}
