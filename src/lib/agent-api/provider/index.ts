import { nativeBookingProvider } from "./native";
export type { BookingProvider } from "./types";
export { ProviderUnsupportedError } from "./types";

// Package A has one engine; no external configuration or transport.
export function getBookingProvider() { return nativeBookingProvider; }
