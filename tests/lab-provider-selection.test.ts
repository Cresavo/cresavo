import { afterEach, expect, it } from "vitest";
import { clearLabBookingProviders, getBookingProvider, registerLabBookingProvider } from "../src/lib/agent-api/provider";
import { nativeBookingProvider } from "../src/lib/agent-api/provider/native";
import { createMockPartnerProvider } from "../src/lib/agent-api/provider/mock-partner";
afterEach(clearLabBookingProviders);
it("pins demo to native and selects only the registered synthetic business", () => {
  const mock = createMockPartnerProvider({ baseUrl: "http://127.0.0.1:3237" });
  expect(getBookingProvider()).toBe(nativeBookingProvider);
  expect(() => registerLabBookingProvider("demo", mock)).toThrow("LAB_PROVIDER_REFUSED");
  expect(() => registerLabBookingProvider("real-business", mock)).toThrow("LAB_PROVIDER_REFUSED");
  registerLabBookingProvider("lab-partner", mock);
  expect(getBookingProvider("lab-partner")).toBe(mock);
  expect(getBookingProvider("demo")).toBe(nativeBookingProvider);
  clearLabBookingProviders();
  expect(() => getBookingProvider("lab-partner")).toThrow("LAB_PROVIDER_NOT_REGISTERED");
  expect(getBookingProvider("demo")).toBe(nativeBookingProvider);
});
