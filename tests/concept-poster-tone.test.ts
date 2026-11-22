import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { defaultPrefill, newDraft, resolvePoster } from "@/concept/campaigns/draft";
import { applyLightContrast, applyWarmth, clampTone, isNeutralTone, toneFilter, toneKey } from "@/concept/campaigns/poster-engine/tone";
import { toKey } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";

describe("poster photo tone", () => {
  it("treats zero as neutral: no filter, no cache key", () => {
    const neutral = { light: 0, contrast: 0, warmth: 0 };
    expect(isNeutralTone(neutral)).toBe(true);
    expect(isNeutralTone(undefined)).toBe(true);
    expect(toneFilter(neutral)).toBe("none");
    expect(toneKey(neutral)).toBe("");
  });

  it("builds the canvas filter and a distinct cache key", () => {
    expect(toneFilter({ light: 10, contrast: -5, warmth: 3 })).toBe("brightness(110%) contrast(95%)");
    expect(toneKey({ light: 10, contrast: -5, warmth: 3 })).not.toBe(toneKey({ light: 10, contrast: -5, warmth: 4 }));
  });

  it("keeps every value inside its range", () => {
    expect(clampTone({ light: 99, contrast: -99, warmth: Number.NaN })).toEqual({ light: 15, contrast: -10, warmth: 0 });
  });

  it("raises red and lowers blue for warmth, and the reverse when cool", () => {
    const warm = new Uint8ClampedArray([100, 100, 100, 255]);
    applyWarmth(warm, 10);
    expect([...warm]).toEqual([110, 100, 90, 255]);
    const cool = new Uint8ClampedArray([100, 100, 100, 255]);
    applyWarmth(cool, -10);
    expect([...cool]).toEqual([90, 100, 110, 255]);
  });

  it("clamps at the channel maximum and leaves pixels alone at zero", () => {
    const bright = new Uint8ClampedArray([250, 10, 250, 255]);
    applyWarmth(bright, 10);
    expect(bright[0]).toBe(255);
    const same = new Uint8ClampedArray([12, 34, 56, 78]);
    applyWarmth(same, 0);
    expect([...same]).toEqual([12, 34, 56, 78]);
  });

  it("is saved on the poster only when it changes something", () => {
    const state = createDemoState(toKey(new Date()));
    const draft = newDraft(defaultPrefill(state, toKey(new Date())));
    expect(resolvePoster(state, draft).photoTone).toBeUndefined();
    expect(resolvePoster(state, { ...draft, posterEdits: { photoTone: { light: 0, contrast: 0, warmth: 0 } } }).photoTone).toBeUndefined();
    const tone = { light: 5, contrast: 0, warmth: -4 };
    expect(resolvePoster(state, { ...draft, posterEdits: { photoTone: tone } }).photoTone).toEqual(tone);
  });
});

describe("unavailable times on a published Free-times poster", () => {
  // A fixed Tuesday morning, so the salon is open and the advertised day has free times.
  const NOW = new Date(2026, 10, 17, 8, 0);
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterAll(() => vi.useRealTimers());

  it("checks the advertised day itself, even when the next day still has the same times", async () => {
    const { unavailablePosterTimes } = await import("@/concept/campaigns/draft");
    const today = toKey(NOW);
    const state = createDemoState(today);
    const draft = { ...newDraft(defaultPrefill(state, today)), style: "slots" as const };
    const poster = resolvePoster(state, draft);
    expect(poster.slotDate).toBeTruthy();
    expect(unavailablePosterTimes(state, poster, draft.serviceIds[0])).toEqual([]);
    // The advertised day fills up (here: the salon closes that weekday); the next day is untouched.
    const weekday = new Date(`${poster.slotDate}T12:00:00Z`).getUTCDay();
    const full = { ...state, salon: { ...state.salon, hours: { ...state.salon.hours, [weekday]: null } } };
    expect(unavailablePosterTimes(full, poster, draft.serviceIds[0])).toEqual(poster.items!.map((item) => item.name));
  });

  it("cannot check older posters without the day, nor other styles", async () => {
    const { unavailablePosterTimes } = await import("@/concept/campaigns/draft");
    const state = createDemoState(toKey(NOW));
    const id = state.services[0].id;
    expect(unavailablePosterTimes(state, { style: "slots", items: [{ name: "10:00", price: "" }] }, id)).toEqual([]);
    expect(unavailablePosterTimes(state, { style: "price", items: [{ name: "10:00", price: "" }], slotDate: toKey(NOW) }, id)).toEqual([]);
  });
});

describe("light and contrast without canvas filters", () => {
  it("matches brightness() and contrast(): grey stays grey at 0, light raises and contrast spreads values", () => {
    const pixels = new Uint8ClampedArray([128, 128, 128, 255, 200, 100, 50, 255]);
    applyLightContrast(pixels, 0, 0);
    expect([...pixels]).toEqual([128, 128, 128, 255, 200, 100, 50, 255]);
    applyLightContrast(pixels, 10, 0);
    expect(pixels[0]).toBe(141);
    const spread = new Uint8ClampedArray([200, 50, 128, 255]);
    applyLightContrast(spread, 0, 10);
    expect([...spread]).toEqual([207, 42, 128, 255]);
  });
});

describe("poster SVGs on one page", () => {
  it("give their ids a unique prefix and keep every reference pointing at its own", async () => {
    const { uniqueIds } = await import("@/concept/campaigns/poster-engine/client");
    const markup = '<svg><defs><clipPath id="satori_cp-id-1"/><linearGradient id="g"/></defs><g clip-path="url(#satori_cp-id-1)"><rect fill="url(#g)"/><use href="#g"/><a href="#top"/></g></svg>';
    const first = uniqueIds(markup, "a-");
    const second = uniqueIds(markup, "b-");
    expect(first).toContain('id="a-satori_cp-id-1"');
    expect(first).toContain('clip-path="url(#a-satori_cp-id-1)"');
    expect(first).toContain('fill="url(#a-g)"');
    expect(first).toContain('href="#a-g"');
    expect(first).toContain('href="#top"');
    expect(second).toContain('clip-path="url(#b-satori_cp-id-1)"');
  });
});
