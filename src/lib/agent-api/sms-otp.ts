import { createHash, randomInt } from "node:crypto";
import { AgentApiError } from "./errors";
import { requireConsentLab } from "./customer-identity";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export function smsOtpRequired(businessId: string) {
  if (process.env.BOOKING_SMS_OTP_LAB !== "1") return false;
  requireConsentLab();
  return (process.env.BOOKING_SMS_OTP_BUSINESSES ?? "").split(",").map(s => s.trim()).includes(businessId);
}
// PTS reserves 070-174 06 05 to 070-174 06 99 for fiction, so the lab can never text a real person.
// https://www.pts.se/internet-och-telefoni/telefonnummer-och-adressering/telefonnummer-till-bocker-och-filmer/
const FICTIONAL_MOBILE = /^\+4670174060[5-9]$|^\+467017406[1-9][0-9]$/;
export function syntheticPhone(phone: unknown) {
  if (typeof phone !== "string" || !FICTIONAL_MOBILE.test(phone)) throw new AgentApiError("invalid_request");
  return { phoneHash: digest(`sms-phone-v1:${phone}`), phoneMask: "+46701740***" };
}
function seconds(name: string, fallback: number, max: number) {
  const n = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(n) || n < 1 || n > max) throw new AgentApiError("invalid_request");
  return n;
}
export const otpTtlSeconds = () => seconds("BOOKING_SMS_OTP_TTL_SECONDS", 600, 900);
export const otpResendSeconds = () => seconds("BOOKING_SMS_OTP_RESEND_SECONDS", 60, 900);
export const otpHash = (id: string, code: string) => digest(`sms-otp-v1:${id}:${code}`);
export function newOtp(id: string, previousHash?: string | null) {
  let code: string;
  do { code = randomInt(0, 1_000_000).toString().padStart(6, "0"); } while (otpHash(id, code) === previousHash);
  return { code, hash: otpHash(id, code) };
}

export type SmsMessage = Readonly<{ proposalId: string; phoneHash: string; phoneMask: string; code: string }>;
/** Only opaque/masked lab destinations, so resend never needs stored raw contact. */
export interface SmsSender { send(message: SmsMessage): void }
export class SimulatedSmsSender implements SmsSender {
  private readonly messages: SmsMessage[] = [];
  send(message: SmsMessage) {
    requireConsentLab();
    this.messages.push(Object.freeze({ ...message }));
    if (this.messages.length > 1000) this.messages.shift();
  }
  read(): readonly SmsMessage[] { requireConsentLab(); return this.messages.slice(); }
  clear() { this.messages.length = 0; }
}
// Process-local lab inbox: never exported through HTTP/MCP or ordinary logs.
export const simulatedSmsSender = new SimulatedSmsSender();
