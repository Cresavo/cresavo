import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureLinkToken } from "@/concept/booking/link-token";

// The booking link's token is taken from the address once, removed from it,
// and still there when React runs the effect a second time. Fictional values.

const replaceState = vi.fn();
let location: { pathname: string; search: string; hash: string };

beforeEach(() => {
  replaceState.mockReset().mockImplementation((_state, _title, url: string) => { location.hash = ""; location.pathname = url.split("?")[0]; });
  location = { pathname: "/boka/salong-fiktiv/booking/ref-1", search: "?a=1", hash: "#t=v1.ref-1.1.abc" };
  vi.stubGlobal("window", { location });
  vi.stubGlobal("history", { replaceState });
});
afterEach(() => vi.unstubAllGlobals());

describe("captureLinkToken", () => {
  it("returns the token, removes it from the address bar and keeps the rest of the address", () => {
    expect(captureLinkToken()).toBe("v1.ref-1.1.abc");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/boka/salong-fiktiv/booking/ref-1?a=1");
  });

  it("gives the same token on a second call, as React's strict mode makes one", () => {
    expect(captureLinkToken()).toBe("v1.ref-1.1.abc");
    expect(captureLinkToken()).toBe("v1.ref-1.1.abc");
    expect(replaceState).toHaveBeenCalledTimes(1);
  });

  it("does not hand a token to another page", () => {
    captureLinkToken();
    location.pathname = "/boka/salong-fiktiv/booking/ref-2";
    expect(captureLinkToken()).toBeUndefined();
  });

  it("returns nothing, and changes nothing, when the address has no token", () => {
    location.hash = "";
    location.pathname = "/boka/salong-fiktiv/booking/ref-3";
    expect(captureLinkToken()).toBeUndefined();
    expect(replaceState).not.toHaveBeenCalled();
  });
});
