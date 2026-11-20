// One server-owned synthetic recipient. This is not real customer authentication.
import { lstatSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve, sep } from "node:path";
import { AgentApiError } from "./errors";
import { requireConsentLab } from "./customer-identity";
import { STAGING_CHANNEL, STAGING_CUSTOMER } from "./consent-staging";

export const CUSTOMER_CHANNEL = "separate-lab-v1";
// Immutable v1 fixture: never replace this with client-supplied contact data.
export const CHANNEL_CUSTOMER = Object.freeze({
  id: "separate-lab-customer-v1", name: "Separat Demokund", email: "separate-customer@example.test",
});

export function separateCustomerChannel() {
  const mode = process.env.BOOKING_CONSENT_DELIVERY;
  // The split-mode staging channel has its own guard in consent-staging.ts.
  if (mode === undefined || mode === "legacy-agent-link" || mode === "staging-inbox") return false;
  if (mode !== "separate-lab") throw new AgentApiError("invalid_request");
  requireConsentLab();
  if (process.env.BOOKING_RUNTIME !== "local" || process.env.VERCEL || process.env.VERCEL_ENV ||
      process.env.VERCEL_URL || process.env.BOOKING_SMS_OTP_LAB === "1")
    throw new AgentApiError("mandate_denied");
  return true;
}

export function prepareCustomerDelivery() {
  if (!separateCustomerChannel()) return null;
  // Created/owned by the test operator, outside the web root. Never sent to a client.
  const directory = process.env.BOOKING_CONSENT_INBOX_DIR;
  try {
    if (!directory || !isAbsolute(directory)) throw new Error();
    const path = resolve(directory), root = realpathSync(tmpdir());
    if (!path.startsWith(root + sep + "booking-consent-inbox-") || realpathSync(path) !== path)
      throw new Error();
    const stat = lstatSync(path);
    if (!stat.isDirectory() || stat.isSymbolicLink() ||
      (process.platform !== "win32" && (stat.mode & 0o077) !== 0)) throw new Error();
    const origin = requireConsentLab();
    return {
      channel: CUSTOMER_CHANNEL,
      send(proposalId: string, token: string) {
        if (!/^[a-f0-9-]{36}$/.test(proposalId) || !/^[A-Za-z0-9_-]{43}$/.test(token))
          throw new AgentApiError("invalid_request");
        try {
          writeFileSync(join(path, proposalId + ".json"), JSON.stringify({
            proposalId, customerSubject: CHANNEL_CUSTOMER.id,
            approvalUrl: `${origin}/consent/${proposalId}#${token}`,
          }) + "\n", { flag: "wx", mode: 0o600 });
        } catch { throw new AgentApiError("internal_error"); }
      },
    };
  } catch { throw new AgentApiError("mandate_denied"); }
}

// Each server-selected channel binds exactly one fixed fictional contact.
const BOUND_CUSTOMERS: Readonly<Record<string, { name: string; email: string }>> = {
  [CUSTOMER_CHANNEL]: CHANNEL_CUSTOMER, [STAGING_CHANNEL]: STAGING_CUSTOMER,
};

export function assertCustomerChannelBinding(
  proposal: { consentDelivery: string | null },
  mandate: { verifiedVia: string | null },
  customer: { name: string; email: string },
) {
  if (proposal.consentDelivery === null && !Object.hasOwn(BOUND_CUSTOMERS, mandate.verifiedVia ?? "")) return;
  const bound = proposal.consentDelivery !== null && Object.hasOwn(BOUND_CUSTOMERS, proposal.consentDelivery)
    ? BOUND_CUSTOMERS[proposal.consentDelivery] : undefined;
  if (!bound || mandate.verifiedVia !== proposal.consentDelivery ||
      customer.name !== bound.name || customer.email !== bound.email)
    throw new AgentApiError("mandate_denied");
}
