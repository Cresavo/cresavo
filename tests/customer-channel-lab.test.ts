import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { chmodSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { assertCustomerChannelBinding, CHANNEL_CUSTOMER, CUSTOMER_CHANNEL, prepareCustomerDelivery, separateCustomerChannel } from "../src/lib/agent-api/customer-channel-lab";

let inbox: string;
const root = realpathSync(tmpdir());
beforeEach(() => {
  inbox = mkdtempSync(join(root, "booking-consent-inbox-")); chmodSync(inbox, 0o700);
  vi.stubEnv("BOOKING_CONSENT_LAB", "1"); vi.stubEnv("BOOKING_RUNTIME", "local");
  vi.stubEnv("BOOKING_CONSENT_DELIVERY", "separate-lab"); vi.stubEnv("BOOKING_CONSENT_INBOX_DIR", inbox);
  vi.stubEnv("BOOKING_PUBLIC_ORIGIN", "http://127.0.0.1:3217");
  vi.stubEnv("DATABASE_URL", "postgresql://synthetic@127.0.0.1:1/channel_test");
});
afterEach(() => {
  vi.unstubAllEnvs();
  if (!resolve(inbox).startsWith(root + sep + "booking-consent-inbox-")) throw new Error("OWN_INBOX_REQUIRED");
  rmSync(inbox, { recursive: true });
});

it("delivers only to the private server-selected customer inbox, without overwriting", () => {
  const delivery = prepareCustomerDelivery()!;
  const id = randomUUID(), token = "t".repeat(43);
  expect(delivery.channel).toBe(CUSTOMER_CHANNEL);
  delivery.send(id, token);
  const receipt = JSON.parse(readFileSync(join(inbox, id + ".json"), "utf8"));
  expect(receipt.customerSubject).toBe(CHANNEL_CUSTOMER.id);
  expect(new URL(receipt.approvalUrl).hash).toBe("#" + token);
  expect(() => delivery.send(id, token)).toThrow("internal error");
  expect(() => delivery.send("../outside", token)).toThrow("request parameters");
});
it.each(["https://remote.example", "relative", root, join(root, "missing-inbox")])("refuses an unsafe inbox %s", directory => {
  vi.stubEnv("BOOKING_CONSENT_INBOX_DIR", directory);
  expect(() => prepareCustomerDelivery()).toThrow();
});
it.each(["BOOKING_CONSENT_LAB", "BOOKING_RUNTIME", "BOOKING_PUBLIC_ORIGIN", "DATABASE_URL", "VERCEL", "VERCEL_ENV", "VERCEL_URL", "BOOKING_SMS_OTP_LAB"])("refuses incompatible or unsafe configuration %s", key => {
  vi.stubEnv(key, ({ BOOKING_CONSENT_LAB: "0", BOOKING_RUNTIME: "vercel", BOOKING_PUBLIC_ORIGIN: "https://remote.example", DATABASE_URL: "postgresql://synthetic@remote.example/real", VERCEL: "1", VERCEL_ENV: "preview", VERCEL_URL: "example.vercel.app", BOOKING_SMS_OTP_LAB: "1" })[key]!);
  expect(() => prepareCustomerDelivery()).toThrow();
});
it("keeps legacy an explicit local lab compatibility mode and rejects unknown modes", () => {
  vi.stubEnv("BOOKING_CONSENT_DELIVERY", "legacy-agent-link"); expect(prepareCustomerDelivery()).toBeNull();
  vi.stubEnv("BOOKING_CONSENT_DELIVERY", "unknown"); expect(() => separateCustomerChannel()).toThrow();
});
it("binds the stored channel and verification to the immutable synthetic contact", () => {
  const proposal = { consentDelivery: CUSTOMER_CHANNEL }, mandate = { verifiedVia: CUSTOMER_CHANNEL };
  expect(() => assertCustomerChannelBinding(proposal, mandate, CHANNEL_CUSTOMER)).not.toThrow();
  for (const customer of [{ ...CHANNEL_CUSTOMER, email: "other@example.test" }, { ...CHANNEL_CUSTOMER, name: "Other Synthetic" }])
    expect(() => assertCustomerChannelBinding(proposal, mandate, customer)).toThrow();
  expect(() => assertCustomerChannelBinding(proposal, { verifiedVia: null }, CHANNEL_CUSTOMER)).toThrow();
  expect(() => assertCustomerChannelBinding({ consentDelivery: null }, mandate, CHANNEL_CUSTOMER)).toThrow();
  expect(() => assertCustomerChannelBinding({ consentDelivery: "unknown" }, mandate, CHANNEL_CUSTOMER)).toThrow();
});
