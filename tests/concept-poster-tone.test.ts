import { describe, expect, it } from "vitest";
import { bookedPosterTimes, defaultPrefill, newDraft, resolvePoster } from "@/concept/campaigns/draft";
import { applyWarmth, clampTone, isNeutralTone, toneFilter, toneKey } from "@/concept/campaigns/poster-engine/tone";
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

describe("booked times on a Free-times poster", () => {
  const today = toKey(new Date());
  const state = createDemoState(today);
  const draft = { ...newDraft(defaultPrefill(state, today)), style: "slots" as const };
  const poster = resolvePoster(state, draft);

  it("finds nothing stale on a poster made just now", () => {
    expect(bookedPosterTimes(state, poster, draft)).toEqual([]);
  });

  it("finds a saved time that is not free", () => {
    const saved = { ...poster, items: [...(poster.items ?? []), { name: "03:07", price: "" }] };
    expect(bookedPosterTimes(state, saved, draft)).toEqual(["03:07"]);
  });

  it("ignores other styles and posters without a treatment", () => {
    expect(bookedPosterTimes(state, { style: "price", items: [{ name: "03:07", price: "" }] }, draft)).toEqual([]);
    expect(bookedPosterTimes(state, { style: "slots", items: [{ name: "03:07", price: "" }] }, { ...draft, serviceIds: [] })).toEqual([]);
  });
});
