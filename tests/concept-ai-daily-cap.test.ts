import { afterEach, expect, it, vi } from "vitest";
import { addressProof } from "../scripts/client-address.mjs";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

it("stops paid AI calls at the daily ceiling even when callers spread across addresses", async () => {
  const token = "fictional-concept-owner-token";
  const secret = "fictional-address-signing-secret";
  vi.stubEnv("CONCEPT_MCP_TOKEN", token);
  vi.stubEnv("BOOKING_ADDRESS_SECRET", secret);
  vi.stubEnv("BOOKING_RUNTIME", "local");
  vi.stubEnv("CONCEPT_AI_FAST_PROVIDER", "openai");
  vi.stubEnv("OPENAI_API_KEY", "fictional-provider-key");
  const fetcher = vi.fn(() => Response.json({ choices: [{ message: { content: '{"text":"AI draft"}' } }] }));
  vi.stubGlobal("fetch", fetcher);
  const { POST } = await import("../src/app/api/concept/ai/[task]/route");
  const body = JSON.stringify({ customerName: "Anna", message: "Can I book tomorrow?" });
  const sources: string[] = [];
  // 30 addresses × 8 calls each stays inside every per-caller limit; only the daily ceiling (200) can stop it.
  for (let a = 0; a < 30; a++) {
    const ip = `203.0.113.${a + 1}`;
    for (let i = 0; i < 8; i++) {
      const response = await POST(new Request("http://localhost/api/concept/ai/reply-customer", {
        method: "POST", body,
        headers: { origin: "http://localhost", authorization: `Bearer ${token}`, "x-booking-client-ip": ip, "x-booking-client-proof": addressProof(ip, secret) },
      }), { params: Promise.resolve({ task: "reply-customer" }) });
      sources.push((await response.json()).log.source);
    }
  }
  expect(sources.filter((source) => source === "ai")).toHaveLength(200);
  expect(fetcher).toHaveBeenCalledTimes(200);
  expect(sources.at(-1)).toBe("rules");
});
