// Split-mode staging customer channel. The salon selects one fixed fictional
// recipient and stores the approval link in a private database inbox that only the
// test operator reads. This is not real customer authentication or delivery.
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
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

// The inbox key: derived from the salon's SESSION_SECRET, held by the salon process and the test
// operator, never by the database. A sealed link in a bind value, a row or an error detail that
// PostgreSQL logs is useless without it.
function inboxKey(secret = process.env.SESSION_SECRET) {
  if (!secret || secret.length < 32) throw new AgentApiError("consent_delivery_unavailable");
  return Buffer.from(hkdfSync("sha256", secret, "cresavo-consent-inbox", "sealed-link-v1", 32));
}

/** AES-256-GCM, bound to the proposal ID: `v1.<iv>.<ciphertext and tag>`, base64url. */
export function sealInboxLink(link: string, proposalId: string, secret?: string) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", inboxKey(secret), iv);
  cipher.setAAD(Buffer.from(proposalId, "utf8"));
  const sealed = Buffer.concat([cipher.update(link, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return `v1.${iv.toString("base64url")}.${sealed.toString("base64url")}`;
}

/** The operator's side: the link for this proposal, or a static error for anything else. */
export function openInboxLink(sealedLink: string, proposalId: string, secret?: string) {
  try {
    const [version, iv, body] = sealedLink.split(".");
    if (version !== "v1" || !iv || !body) throw new Error();
    const data = Buffer.from(body, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", inboxKey(secret), Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(proposalId, "utf8"));
    decipher.setAuthTag(data.subarray(data.length - 16));
    return Buffer.concat([decipher.update(data.subarray(0, data.length - 16)), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("CONSENT_INBOX_SEALED_LINK_INVALID");
  }
}

export const stagingInbox = {
  /** Runs inside the proposal transaction: a failed delivery leaves no proposal behind. */
  async deliver(tx: Prisma.TransactionClient, origin: string, proposalId: string, token: string) {
    // Only the sealed link reaches the database, so PostgreSQL can log nothing usable. A database
    // error is still replaced by a static code here, never logged, wrapped or passed on as a cause.
    try {
      const sealedLink = sealInboxLink(stagingApprovalLink(origin, proposalId, token), proposalId);
      await tx.consentInboxMessage.create({ data: { proposalId, recipientId: STAGING_CUSTOMER.id, sealedLink } });
    }
    catch { throw new AgentApiError("consent_delivery_unavailable"); }
  },
  /** Marks the one message for this proposal as used; refuses a missing or already used message. */
  async consume(tx: Prisma.TransactionClient, proposalId: string, at: Date) {
    let count: number;
    try {
      ({ count } = await tx.consentInboxMessage.updateMany({
        where: { proposalId, recipientId: STAGING_CUSTOMER.id, consumedAt: null }, data: { consumedAt: at },
      }));
    } catch { throw new Error("CONSENT_INBOX_UNAVAILABLE"); }
    if (count !== 1) throw new AgentApiError("mandate_denied");
  },
};

/**
 * A valid link whose proposal is no longer pending. Shown to the link holder; grants nothing.
 * A used link also names the decision recorded with it, so a customer whose response was lost
 * can tell approval from decline. It never carries terms, a mandate ID or other authority.
 */
export class ConsentLinkState extends Error {
  constructor(readonly state: "used" | "expired", readonly decision?: "approved" | "declined") { super("CONSENT_LINK_STATE"); }
}
