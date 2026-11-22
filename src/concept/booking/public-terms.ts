import type { DemoState, Service } from "../data/types";
import { quote, type BookingTerms } from "./protection";

/**
 * The terms a guest on a salon's public page accepts by booking: price,
 * currency, length, and the cancellation policy that applies to a new
 * customer (its version covers any later change). The page sends what it
 * showed; the reducer books only while the salon's terms are still these.
 */
export type AcceptedTerms = BookingTerms & { duration: number };

export function acceptedTerms(state: Pick<DemoState, "cancellationPolicy" | "localization">, service: Pick<Service, "id" | "price" | "duration">): AcceptedTerms {
  return { ...quote(state.cancellationPolicy, service, state.localization.currency, true), duration: service.duration };
}
