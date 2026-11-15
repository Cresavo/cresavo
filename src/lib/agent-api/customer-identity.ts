import { createHash, randomBytes } from "node:crypto";
import { assertTestDatabase } from "../../../scripts/test-db-guard.mjs";
import { discoveryOrigin } from "./discovery";
import { AgentApiError } from "./errors";

export interface CustomerIdentityProvider {
  displayName: string;
  issueCredential(): { token: string; digest: string };
  credentialDigest(token: string): string;
  deliver(proposalId: string, token: string): { approvalUrl?: string };
}
export function requireConsentLab() {
  const origin = discoveryOrigin();
  if (process.env.BOOKING_CONSENT_LAB !== "1" || process.env.BOOKING_RUNTIME === "vercel" ||
      !["127.0.0.1", "localhost", "[::1]"].includes(new URL(origin).hostname))
    throw new AgentApiError("mandate_denied");
  assertTestDatabase();
  return origin;
}
// Replace delivery AND customer verification together before any real deployment.
// The lab intentionally hands the bearer link to the caller; it proves no real identity.
export const labCustomerIdentity: CustomerIdentityProvider = {
  displayName: "Syntetisk Testkund",
  issueCredential() { const token = newCustomerToken(); return { token, digest: customerTokenHash(token) }; },
  credentialDigest: token => customerTokenHash(token),
  deliver(id, token) {
    // Fragment never reaches HTTP access logs or Referrer headers.
    return { approvalUrl: `${requireConsentLab()}/consent/${id}#${token}` };
  },
};
export const newCustomerToken = () => randomBytes(32).toString("base64url");
export const customerTokenHash = (token: string) => createHash("sha256").update(`customer-consent-v1:${token}`).digest("hex");
