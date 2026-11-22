import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import NotFound from "@/app/boka/not-found";
import { captureLinkToken, LinkTokenScrub } from "@/concept/booking/link-token";

// The booking link's token is taken from the address once, removed from it,
// and still there when React runs the effect a second time. Fictional values.

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

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

describe("the not-found boundary of /boka", () => {
  /** True when the element tree holds this component type. */
  const holds = (node: ReactNode, type: unknown): boolean => {
    if (!node || typeof node !== "object") return false;
    if (Array.isArray(node)) return node.some((child) => holds(child, type));
    const element = node as { type: unknown; props?: { children?: ReactNode } };
    return element.type === type || holds(element.props?.children, type);
  };

  it("mounts the scrubber, so an unknown salon's 404 does not keep the token in its address", async () => {
    expect(holds(await NotFound(), LinkTokenScrub)).toBe(true);
  });
});
