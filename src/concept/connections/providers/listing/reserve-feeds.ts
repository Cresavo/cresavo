// Reserve with Google feed builder. Pure and browser-safe so the simulated
// adapter can show exactly what would be uploaded.
// Sources (checked 2026-11):
// - Feeds (Merchant, Services, Availability; PROCESS_AS_COMPLETE; JSON recommended):
//   https://developers.google.com/actions-center/verticals/local-services/e2e/integration-steps/export-feeds
// - Redirect feeds: https://developers.google.com/actions-center/verticals/appointments/redirect/reference/feeds/overview
// verify: field names below follow the proto3 JSON mapping in Google's feed references; confirm against the
// Partner Portal's feed validator before the first upload (it rejects unknown fields).
import { connectionError, fail, isCountry, isCurrency, isUtc, minorDigits, ok, stableHash, type PortName, type PortResult } from "../../core";
import type { FeedFile, ListingSnapshot } from "../../ports/listing";

const seconds = (utc: string) => String(Math.floor(Date.parse(utc) / 1000));

export function buildReserveFeeds(snapshot: ListingSnapshot, generatedAt: string, port: PortName, provider: string): PortResult<FeedFile[]> {
  const { merchant, services, slots } = snapshot;
  const valid = isUtc(generatedAt) && isCountry(merchant.address.country) && services.every((s) => isCurrency(s.price.currency) && Number.isSafeInteger(s.price.amountMinor)) &&
    slots.every((s) => isUtc(s.start) && s.durationMinutes > 0 && services.some((service) => service.id === s.serviceId));
  if (!valid) return fail(connectionError(port, provider, "invalid_input"));
  const metadata = (kind: string) => ({
    processing_instruction: "PROCESS_AS_COMPLETE",
    shard_number: 0,
    total_shards: 1,
    nonce: stableHash(`${kind}:${merchant.id}:${generatedAt}`),
    generation_timestamp: seconds(generatedAt),
  });
  const file = (name: string, body: unknown): FeedFile => ({ name, contentType: "application/json", body: JSON.stringify(body) });
  // price_micros: millionths of the major unit.
  const micros = (amountMinor: number, currency: string) => String(amountMinor * 10 ** (6 - minorDigits(currency)));
  return ok([
    file(`merchant_${generatedAt.slice(0, 10)}.json`, {
      metadata: metadata("merchant"),
      merchant: [{
        merchant_id: merchant.id,
        name: merchant.name,
        ...(merchant.phone ? { telephone: merchant.phone } : {}),
        url: merchant.url,
        geo: { address: { country: merchant.address.country, locality: merchant.address.locality, postal_code: merchant.address.postalCode, street_address: merchant.address.street } },
      }],
    }),
    file(`service_${generatedAt.slice(0, 10)}.json`, {
      metadata: metadata("service"),
      service: services.map((s) => ({
        merchant_id: merchant.id,
        service_id: s.id,
        name: s.name,
        ...(s.description ? { description: s.description } : {}),
        price: { price_micros: micros(s.price.amountMinor, s.price.currency), currency_code: s.price.currency },
        localized_service_name: { value: s.name, localized_value: [{ locale: merchant.language, value: s.name }] },
      })),
    }),
    file(`availability_${generatedAt.slice(0, 10)}.json`, {
      metadata: metadata("availability"),
      service_availability: [{
        availability: slots.map((s) => ({
          merchant_id: merchant.id,
          service_id: s.serviceId,
          start_sec: seconds(s.start),
          duration_sec: String(s.durationMinutes * 60),
          spots_total: String(Math.max(1, s.spotsOpen)),
          spots_open: String(s.spotsOpen),
          ...(s.staffId ? { resources: { staff_id: s.staffId } } : {}),
        })),
      }],
    }),
  ], "simulated");
}
