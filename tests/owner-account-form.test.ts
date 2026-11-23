import { describe, expect, it } from "vitest";
import { accountError } from "@/concept/account/account-form";
import { mfaError } from "@/concept/account/mfa-client";

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

describe("two-step sign-in errors", () => {
  it("maps API codes to dictionary keys and reads a malformed code as a wrong one", () => {
    expect(mfaError(401, "invalid_code")).toBe("account.error.invalid_code");
    expect(mfaError(400, "invalid")).toBe("account.error.invalid_code");
    expect(mfaError(401, "mfa_expired")).toBe("account.error.mfa_expired");
    expect(mfaError(503, "not_configured")).toBe("account.error.not_configured");
    expect(mfaError(403, "wrong_password")).toBe("account.error.wrong_password");
    expect(mfaError(409, "setup_expired")).toBe("account.error.setup_expired");
  });

  it("shows the rate limit and never echoes unknown codes", () => {
    expect(mfaError(429, "invalid_code")).toBe("account.error.tooMany");
    expect(mfaError(500, "<script>")).toBe("account.error.generic");
    expect(mfaError(0, undefined)).toBe("account.error.generic");
  });
});
