import { describe, expect, it } from "vitest";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import config from "../next.config";

/** The headers Next sends for `pathname`: every matching rule in order, a later one replacing an earlier one's key. */
async function headersFor(pathname: string) {
  const resolved: Record<string, string> = {};
  for (const rule of await config.headers!())
    if (getPathMatch(rule.source)(pathname)) for (const { key, value } of rule.headers) resolved[key.toLowerCase()] = value;
  return resolved;
}

describe("response headers", () => {
  it("send no-referrer on the consent document and its decision endpoint, as an HTTP header", async () => {
    const id = "0b7c3f6e-6a1d-4c11-9d0e-3f1f0c1d2e3f";
    for (const path of [`/consent/${id}`, `/consent/${id}/decision`])
      expect((await headersFor(path))["referrer-policy"], path).toBe("no-referrer");
    // Everything else keeps the site-wide policy.
    for (const path of ["/", "/admin", "/boka/salong-eko", "/consentx"])
      expect((await headersFor(path))["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
  });
});
