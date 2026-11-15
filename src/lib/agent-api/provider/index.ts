import { nativeBookingProvider } from "./native";
import type { BookingProvider } from "./types";
export type { BookingProvider } from "./types";
export { ProviderUnsupportedError } from "./types";

const providers = new Map<string, BookingProvider>();
/** Trusted in-process lab configuration only; demo cannot be overridden. */
export function registerLabBookingProvider(businessId: string, provider: BookingProvider) {
  if (businessId !== "lab-partner" || provider.id !== "mock-partner" || process.env.BOOKING_RUNTIME === "vercel")
    throw new Error("LAB_PROVIDER_REFUSED");
  providers.set(businessId, provider);
}
export function clearLabBookingProviders() { providers.clear(); }
export function getBookingProvider(businessId = "demo") {
  if (businessId === "demo") return nativeBookingProvider;
  const provider = providers.get(businessId);
  if (!provider) throw new Error("LAB_PROVIDER_NOT_REGISTERED");
  return provider;
}
