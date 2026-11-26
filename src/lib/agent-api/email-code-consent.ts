// Customer consent with a one-time e-mail code (ADR 7). The consent link carries no secret: the
// customer types their own address, receives a six-digit code there and approves with it. The
// mandate is bound to that address, so an agent can only book in the name of someone who read the code.
// Lab profile: synthetic @example.test addresses and a simulated inbox, never a real e-mail.
import { createHash, randomInt } from "node:crypto";
import { lstatSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve, sep } from "node:path";
import { AgentApiError } from "./errors";
import { requireConsentLab } from "./customer-identity";

export const EMAIL_CODE_CHANNEL = "email-code-v1";
export const MAX_CODE_SENDS = 5;
export const MAX_CODE_ATTEMPTS = 5;

function seconds(name: string, fallback: number, max: number) {
  const n = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(n) || n < 1 || n > max) throw new AgentApiError("invalid_request");
  return n;
}
export const codeTtlSeconds = () => seconds("BOOKING_CONSENT_CODE_TTL_SECONDS", 600, 900);
export const codeResendSeconds = () => seconds("BOOKING_CONSENT_CODE_RESEND_SECONDS", 60, 900);

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const codeHash = (proposalId: string, code: string) => digest(`consent-code-v1:${proposalId}:${code}`);
export function newCode(proposalId: string, previousHash?: string | null) {
  let code: string;
  do { code = randomInt(0, 1_000_000).toString().padStart(6, "0"); } while (codeHash(proposalId, code) === previousHash);
  return { code, hash: codeHash(proposalId, code) };
}

const SYNTHETIC_EMAIL = /^[a-z0-9][a-z0-9._+-]{0,63}@example\.test$/;
export const contactEmailHash = (email: string) => digest(`consent-email-v1:${email.trim().toLowerCase()}`);

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

/**
 * The operator's private inbox directory for a proof that runs the salon in another process, or
 * null. It must be a private directory the test operator created in the system temp folder.
 */
function operatorInbox() {
  const directory = process.env.BOOKING_CONSENT_INBOX_DIR;
  if (!directory) return null;
  try {
    if (!isAbsolute(directory)) throw new Error();
    const path = resolve(directory), root = realpathSync(tmpdir());
    if (!path.startsWith(root + sep + "booking-consent-inbox-") || realpathSync(path) !== path) throw new Error();
    const stat = lstatSync(path);
    if (!stat.isDirectory() || stat.isSymbolicLink() || (process.platform !== "win32" && (stat.mode & 0o077) !== 0)) throw new Error();
    return path;
  } catch { throw new AgentApiError("mandate_denied"); }
}

/** Simulated delivery: a process-local inbox, and the operator's private directory when one is set. */
export class SimulatedEmailCodeSender implements EmailCodeSender {
  private readonly messages: EmailCodeMessage[] = [];
  send(message: EmailCodeMessage) {
    requireConsentLab();
    this.messages.push(Object.freeze({ ...message }));
    if (this.messages.length > 1000) this.messages.shift();
    const inbox = operatorInbox();
    if (inbox && /^[a-f0-9-]{36}$/.test(message.proposalId)) {
      // The newest code replaces the last one; never served over HTTP or MCP.
      writeFileSync(join(inbox, message.proposalId + ".json"), JSON.stringify({
        proposalId: message.proposalId, contactEmailMask: message.contactEmailMask, code: message.code,
      }) + "\n", { mode: 0o600 });
    }
  }
  read(): readonly EmailCodeMessage[] { requireConsentLab(); return this.messages.slice(); }
  clear() { this.messages.length = 0; }
}
// Never exported through HTTP/MCP or ordinary logs.
export const simulatedEmailCodeSender = new SimulatedEmailCodeSender();
