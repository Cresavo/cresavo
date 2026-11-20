import { afterEach, describe, expect, it, vi } from "vitest";

// The lab form's first effect, run directly: no DOM is needed to see what it reads and sends.
vi.mock("react", () => ({
  useEffect: (effect: () => unknown) => { effect(); },
  useRef: <T,>(value: T) => ({ current: value }),
  useState: <T,>(value: T) => [value, () => {}],
}));

function openLab(href: string, origin: string) {
  const url = new URL(href);
  const location = { origin: url.origin, hash: url.hash, pathname: url.pathname };
  const replaceState = vi.fn((_state: unknown, _title: string, path: string) => { location.hash = ""; location.pathname = path; });
  const fetch = vi.fn(async () => new Response("{}", { status: 400 }));
  vi.stubGlobal("window", { location, history: { replaceState } });
  vi.stubGlobal("fetch", fetch);
  return import("../src/app/consent/[id]/form").then(({ default: ConsentForm }) => {
    ConsentForm({ id: "proposal-1", origin });
    return { location, replaceState, fetch };
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("legacy lab consent form", () => {
  const lab = "http://127.0.0.1:3229";
  it("reads and posts the secret only on the lab's own loopback origin", async () => {
    const { fetch, location } = await openLab(`${lab}/consent/proposal-1#lab-secret`, lab);
    expect(location.hash).toBe("");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body)).token).toBe("lab-secret");
  });
  it("elsewhere removes the secret from the address bar unread and sends nothing", async () => {
    for (const href of ["https://salon-demo.cresavo.test/consent/proposal-1#lab-secret", "http://127.0.0.1:3000/consent/proposal-1#lab-secret",
      "http://localhost:3229/consent/proposal-1#lab-secret"]) {
      const { fetch, location, replaceState } = await openLab(href, lab);
      expect(replaceState, href).toHaveBeenCalledTimes(1);
      expect(location.hash, href).toBe("");
      expect(fetch, href).not.toHaveBeenCalled();
    }
  });
});
