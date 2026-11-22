import { describe, expect, it } from "vitest";
import { accountError } from "@/concept/account/account-form";

describe("account form errors", () => {
  it("maps API codes to dictionary keys", () => {
    expect(accountError(409, "email_taken")).toBe("account.error.email_taken");
    expect(accountError(401, "invalid_credentials")).toBe("account.error.invalid_credentials");
    expect(accountError(400, "invalid")).toBe("account.error.invalid");
    expect(accountError(503, "slug_unavailable")).toBe("account.error.slug_unavailable");
  });

  it("shows the rate limit and never echoes unknown codes", () => {
    expect(accountError(429, "invalid_credentials")).toBe("account.error.tooMany");
    expect(accountError(500, "<script>")).toBe("account.error.generic");
    expect(accountError(500, undefined)).toBe("account.error.generic");
  });
});
