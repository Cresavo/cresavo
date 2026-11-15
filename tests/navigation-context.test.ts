import { describe, expect, it } from "vitest";
import {
  contextualHref,
  returnContext,
  returnHref,
  returnLabel,
  safeReturnTo,
} from "../src/lib/navigation-context";

describe("UI return context never grants access or redirects externally", () => {
  it.each([
    undefined,
    ["/admin"],
    "https://evil.example/admin",
    "//evil.example/admin",
    "/\\evil.example",
    "/admin\n",
    "/api/admin/customers",
    "/admin/unknown",
    "/admin/" + "x".repeat(4096),
  ])("rejects unsafe return %j", (value) => {
    expect(safeReturnTo(value, "/admin/customers")).toBe("/admin/customers");
  });
  it("preserves calendar filters and nested booking/customer context", () => {
    const calendar =
      "/admin?date=2026-11-16&view=week&staffId=demo&status=all&cursor=opaque";
    const key = "a9c446e7-ccba-48ad-b729-de703edc847c";
    const booking = contextualHref("/admin/bookings/demo-book", {
      returnTo: calendar,
      returnKey: key,
    });
    const customer = contextualHref(
      "/admin/customers/demo-customer?view=history",
      { returnTo: booking },
    );
    const url = new URL(customer, "http://local.invalid");
    expect(safeReturnTo(url.searchParams.get("returnTo"))).toBe(booking);
    expect(
      returnHref(
        returnContext({ returnTo: calendar, returnKey: key }, "/admin"),
        "/admin",
      ),
    ).toBe(calendar + "#return-" + key);
    expect(returnLabel(booking)).toBe("Till bokningen");
    expect(returnLabel(customer)).toBe("Till kundkortet");
  });
  it("ignores malformed scroll keys while retaining a safe direct-link fallback", () => {
    expect(
      returnContext(
        { returnTo: "//external.invalid", returnKey: ["x"] },
        "/admin/overview",
      ),
    ).toEqual({ returnTo: "/admin/overview" });
    expect(
      returnHref(
        { returnTo: "/admin/customers?q=Mira", returnKey: "x#injection" },
        "/admin",
      ),
    ).toBe("/admin/customers?q=Mira");
  });
});
