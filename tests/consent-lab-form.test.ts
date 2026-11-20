import { afterEach, describe, expect, it, vi } from "vitest";
import { labCopy } from "../src/app/consent/[id]/lab-copy";

const shown = vi.hoisted(() => ({ messages: [] as unknown[] }));

// The lab form's first effect, run directly: no DOM is needed to see what it reads and sends.
vi.mock("react", () => ({
  useEffect: (effect: () => unknown) => { effect(); },
  useRef: <T,>(value: T) => ({ current: value }),
  useState: <T,>(value: T) => [value, (next: unknown) => { shown.messages.push(next); }],
}));

function openLab(href: string, origin: string, locale: "en" | "sv" = "en") {
  shown.messages = [];
  const url = new URL(href);
  const location = { origin: url.origin, hash: url.hash, pathname: url.pathname };
  const replaceState = vi.fn((_state: unknown, _title: string, path: string) => { location.hash = ""; location.pathname = path; });
  const fetch = vi.fn(async () => new Response("{}", { status: 400 }));
  vi.stubGlobal("window", { location, history: { replaceState } });
  vi.stubGlobal("fetch", fetch);
  return import("../src/app/consent/[id]/form").then(({ default: ConsentForm }) => {
    ConsentForm({ id: "proposal-1", origin, locale });
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
  it("says so in the chosen language when there is no secret to read", async () => {
    for (const locale of ["en", "sv"] as const) {
      // A reload after the fragment was removed, and a link opened at another address.
      for (const href of [`${lab}/consent/proposal-1`, "https://salon-demo.cresavo.test/consent/proposal-1#lab-secret"]) {
        await openLab(href, lab, locale);
        expect(shown.messages, `${locale} ${href}`).toEqual([labCopy[locale].missingLink]);
      }
    }
    expect(labCopy.en.missingLink).toMatch(/Nothing was sent/);
    expect(labCopy.sv.missingLink).toMatch(/Inget skickades/);
  });
  it("has the same keys and placeholders in English and Swedish", () => {
    const placeholders = (value: string) => [...value.matchAll(/\{\w+\}/g)].map(match => match[0]).sort();
    expect(Object.keys(labCopy.sv).sort()).toEqual(Object.keys(labCopy.en).sort());
    for (const key of Object.keys(labCopy.en) as (keyof typeof labCopy.en)[]) {
      expect(labCopy.sv[key], key).not.toBe("");
      expect(labCopy.sv[key], key).not.toBe(labCopy.en[key]);
      expect(placeholders(labCopy.sv[key]), key).toEqual(placeholders(labCopy.en[key]));
    }
  });
});
