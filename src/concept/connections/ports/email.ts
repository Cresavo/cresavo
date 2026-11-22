import type { Adapter, LanguageTag, PortResult, DeliveryStatus, UtcTimestamp } from "../core";
import type { WebhookRequest } from "./webhook";

export type EmailCapability = "send" | "html" | "tags" | "idempotency" | "event-webhook";

export interface EmailMessage {
  /** Plain addresses. The simulated adapter also accepts a recipient reference such as "customer:c-12". */
  to: string[];
  /** "Name <address>" or a bare address on a domain verified with the provider. */
  from: string;
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
  language?: LanguageTag;
  /** Short key/value labels for the provider's dashboard. No personal data. */
  tags?: Record<string, string>;
  idempotencyKey?: string;
  /** False turns link and open tracking off for this message where the provider tracks per message (Postmark). Resend tracks per sending domain. */
  tracking?: false;
  /** Your own stable id for the send. Kept by the simulated adapter; never sent to a provider. */
  reference?: string;
}

export interface EmailReceipt {
  id: string;
  to: string[];
}

export interface EmailEvent {
  providerId: string;
  status: DeliveryStatus;
  at?: UtcTimestamp;
}

export interface EmailPort extends Adapter<EmailCapability> {
  send(message: EmailMessage): Promise<PortResult<EmailReceipt>>;
  verifyWebhook?(request: WebhookRequest): Promise<PortResult<EmailEvent>>;
}
