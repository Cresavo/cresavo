import type { Adapter, PhoneE164, PortResult, DeliveryStatus, UtcTimestamp } from "../core";
import type { WebhookRequest } from "./webhook";

export type SmsCapability = "send" | "alphanumeric-sender" | "delivery-webhook" | "idempotency";

export interface SmsMessage {
  /** E.164. The simulated adapter also accepts a recipient reference such as "customer:c-12". */
  to: PhoneE164;
  /** E.164 number or an alphanumeric sender id (max 11 characters) where the country allows it. */
  from?: string;
  body: string;
  /** Our own reference, echoed back in delivery events where the provider supports it. */
  reference?: string;
  /** Public HTTPS URL for delivery reports. */
  statusCallbackUrl?: string;
  idempotencyKey?: string;
}

export interface SmsReceipt {
  id: string;
  to: string;
  /** Number of 160/70-character segments the body needs. */
  segments: number;
}

export interface SmsDeliveryEvent {
  providerId: string;
  status: DeliveryStatus;
  at?: UtcTimestamp;
}

export interface SmsPort extends Adapter<SmsCapability> {
  send(message: SmsMessage): Promise<PortResult<SmsReceipt>>;
  /** Verifies and parses a delivery report. Absent when the provider does not sign them. */
  verifyWebhook?(request: WebhookRequest): Promise<PortResult<SmsDeliveryEvent>>;
}

/** GSM 03.38 basic set; anything else needs UCS-2 (70 characters per segment). */
const GSM = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà^{}\\[~\]|€]*$/;

export function smsSegments(body: string): number {
  const gsm = GSM.test(body);
  // UCS-2 counts UTF-16 code units, so an emoji outside the BMP takes two.
  const length = gsm ? [...body].reduce((n, c) => n + ("^{}\\[~]|€".includes(c) ? 2 : 1), 0) : body.length;
  const single = gsm ? 160 : 70;
  const multi = gsm ? 153 : 67;
  return length <= single ? 1 : Math.ceil(length / multi);
}
