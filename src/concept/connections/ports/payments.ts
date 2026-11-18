import type { Adapter, LanguageTag, Money, PortResult, UtcTimestamp } from "../core";
import type { WebhookRequest } from "./webhook";

export type PaymentsCapability = "checkout" | "payment-link" | "refund" | "webhook" | "idempotency";

/** Methods the business may offer. Availability depends on provider, account country and currency. */
export type PaymentMethod = "card" | "klarna" | "swish" | "mobilepay" | "vipps" | "ideal" | "bancontact" | "apple_pay" | "google_pay";

export interface CheckoutInput {
  amount: Money;
  /** Line shown to the customer, e.g. "Haircut 45 min". */
  description: string;
  /** Our booking or order id; echoed back in webhook events. */
  reference: string;
  successUrl: string;
  cancelUrl: string;
  /** Leave empty to let the provider choose from the account's enabled methods. */
  methods?: PaymentMethod[];
  customerEmail?: string;
  locale?: LanguageTag;
  idempotencyKey: string;
}

export interface CheckoutSession {
  id: string;
  /** Hosted page the customer opens. */
  url: string;
  expiresAt?: UtcTimestamp;
}

export interface RefundInput {
  /** Provider payment id (e.g. a Stripe PaymentIntent id). */
  paymentId: string;
  /** Omit for a full refund. */
  amount?: Money;
  reason?: "requested_by_customer" | "duplicate" | "fraudulent";
  idempotencyKey: string;
}

export interface Refund {
  id: string;
  amount: Money | null;
  state: "pending" | "succeeded" | "failed";
}

export interface PaymentEvent {
  id: string;
  type: "checkout.completed" | "payment.succeeded" | "payment.failed" | "refund.updated" | "other";
  reference?: string;
  paymentId?: string;
  amount?: Money;
}

export interface PaymentsPort extends Adapter<PaymentsCapability> {
  createCheckout(input: CheckoutInput): Promise<PortResult<CheckoutSession>>;
  createPaymentLink(input: Omit<CheckoutInput, "successUrl" | "cancelUrl"> & { successUrl?: string }): Promise<PortResult<CheckoutSession>>;
  refund(input: RefundInput): Promise<PortResult<Refund>>;
  verifyWebhook(request: WebhookRequest): Promise<PortResult<PaymentEvent>>;
}
