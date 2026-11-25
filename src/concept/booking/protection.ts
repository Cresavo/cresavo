import { minorDigits } from "../connections/core";
import type { Booking, DemoState, Service } from "../data/types";
import type { OnlineGuest, OnlineNotice } from "../actions";

export interface CancellationPolicy {
  version: number;
  freeHours: number;
  latePercent: number;
  noShowPercent: number;
  /** Whether a treatment without its own choice is paid at the salon instead of in full when booked online. */
  payAtSalonDefault: boolean;
  /** A treatment's own choice; a missing entry follows `payAtSalonDefault`. */
  payAtSalon: Record<string, boolean>;
  /** A smaller amount to pay when booking than the full price; a missing entry means the full price. */
  deposits: Record<string, number>;
  newCustomersOnly: boolean;
  exemptServices: string[];
}

/** A new salon takes the full price when a treatment is booked online, unless the owner lets customers pay at the salon. */
export const DEFAULT_POLICY: CancellationPolicy = {
  version: 1, freeHours: 24, latePercent: 0, noShowPercent: 0,
  payAtSalonDefault: false, payAtSalon: {}, deposits: {}, newCustomersOnly: false, exemptServices: [],
};

export type Incident = "noshow" | "late";
export type DemoMethod = "card" | "swish";

export interface BookingTerms {
  version: number;
  freeHours: number;
  latePercent: number;
  noShowPercent: number;
  currency: string;
  priceMinor: number;
  depositMinor: number;
}

export interface BookingProtection {
  terms: BookingTerms;
  deposit?: { id: string; method: DemoMethod };
  refund?: { id: string; amountMinor: number };
  decision?: {
    incident: Incident;
    outcome: "charge" | "waive";
    proposedMinor: number;
    chargedMinor: number;
    paymentId?: string;
    reason?: string;
    actor: "owner";
    at: number;
  };
}

export interface CheckoutHold extends Pick<Booking, "serviceId" | "staffId" | "date" | "start" | "resourceId" | "duration" | "bufferBefore" | "bufferAfter" | "processing"> {
  id: string;
  expiresAt: number;
  terms: BookingTerms;
  guest: OnlineGuest;
  notice: OnlineNotice;
}

const isRecord = (value: unknown): value is Record<string, unknown> => value != null && typeof value === "object" && !Array.isArray(value);

export function validPolicy(policy: CancellationPolicy) {
  const within = (n: number, max: number) => Number.isSafeInteger(n) && n >= 0 && n <= max;
  return typeof policy.payAtSalonDefault === "boolean" && isRecord(policy.payAtSalon) &&
    Object.values(policy.payAtSalon).every(value => typeof value === "boolean") && typeof policy.newCustomersOnly === "boolean" && Array.isArray(policy.exemptServices) &&
    policy.exemptServices.every(id => typeof id === "string") && policy.deposits != null && typeof policy.deposits === "object" &&
    !Array.isArray(policy.deposits) && within(policy.freeHours, 8760) && within(policy.latePercent, 100) && within(policy.noShowPercent, 100) &&
    Object.values(policy.deposits).every(n => within(n, Number.MAX_SAFE_INTEGER));
}

/** Service ids a policy change adds or gives a new amount that the price list does not have. Old entries may stay as they are or be removed. */
export function unknownPolicyServices(current: CancellationPolicy, next: CancellationPolicy, services: readonly Pick<Service, "id">[]): string[] {
  const known = new Set(services.map(service => service.id));
  const changed = <T>(before: Record<string, T>, after: Record<string, T>) => Object.keys(after).filter(id => !Object.hasOwn(before, id) || before[id] !== after[id]);
  const added = [...changed(current.deposits, next.deposits), ...changed(current.payAtSalon, next.payAtSalon), ...next.exemptServices.filter(id => !current.exemptServices.includes(id))];
  return added.filter(id => !known.has(id));
}

export function toMinor(amount: number, currency: string) {
  return Math.round(amount * 10 ** minorDigits(currency));
}

/** Whether customers pay for this treatment at the salon rather than when they book. */
export const paysAtSalon = (policy: Pick<CancellationPolicy, "payAtSalon" | "payAtSalonDefault">, serviceId: string) =>
  policy.payAtSalon[serviceId] ?? policy.payAtSalonDefault;

export function quote(policy: CancellationPolicy, service: Pick<Service, "id" | "price">, currency: string, newCustomer: boolean): BookingTerms {
  const exempt = policy.exemptServices.includes(service.id);
  const priceMinor = toMinor(service.price, currency);
  const free = exempt || (policy.newCustomersOnly && !newCustomer) || paysAtSalon(policy, service.id);
  return {
    version: policy.version, freeHours: policy.freeHours, currency, priceMinor,
    latePercent: exempt ? 0 : policy.latePercent, noShowPercent: exempt ? 0 : policy.noShowPercent,
    depositMinor: free ? 0 : Math.min(priceMinor, policy.deposits[service.id] ?? priceMinor),
  };
}

export function hasSettlement(booking: Booking) {
  return !!(booking.protection?.decision || booking.protection?.refund);
}

/** Older visits retain the fee-free terms under which they were booked. */
export function termsOf(booking: Booking, state: Pick<DemoState, "localization">) {
  return booking.protection?.terms ?? quote({ ...DEFAULT_POLICY, payAtSalonDefault: true }, { id: booking.serviceId, price: booking.price }, state.localization.currency, false);
}

export function feeMinor(terms: BookingTerms, incident: Incident) {
  return Math.round(terms.priceMinor * (incident === "noshow" ? terms.noShowPercent : terms.latePercent) / 100);
}

/** Apply the deposit first. A waiver or ordinary cancellation has a final fee of zero. */
export function settleFee(depositPaid: number, finalFee: number) {
  return { additional: Math.max(0, finalFee - depositPaid), refund: Math.max(0, depositPaid - finalFee) };
}

export function paymentBalance(protection: BookingProtection, ended: boolean, giftMinor = 0) {
  const deposit = protection.deposit ? protection.terms.depositMinor : 0;
  const refund = protection.refund?.amountMinor ?? 0;
  const paid = deposit - refund + (protection.decision?.chargedMinor ?? 0) + (ended ? 0 : giftMinor);
  return { deposit, refund, paid, remaining: ended ? 0 : Math.max(0, protection.terms.priceMinor - paid) };
}
