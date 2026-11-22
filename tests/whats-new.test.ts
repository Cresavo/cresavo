import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/concept/i18n/en";
import { sv } from "@/concept/i18n/sv";
import { SEEN_KEY, markSeen, readLastSeen } from "@/concept/studio/help/whats-new-seen";
import { WHATS_NEW, compareVersions, hasUnseen, latestVersion } from "@/concept/whats-new";

afterEach(() => vi.unstubAllGlobals());

describe("what's new list", () => {
  it("has releases with a version, an ISO date and items, newest first", () => {
    expect(WHATS_NEW.length).toBeGreaterThan(0);
    for (const entry of WHATS_NEW) {
      expect(entry.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.items.length).toBeGreaterThan(0);
    }
    for (let i = 1; i < WHATS_NEW.length; i++) {
      expect(compareVersions(WHATS_NEW[i - 1].version, WHATS_NEW[i].version)).toBe(1);
      expect(WHATS_NEW[i - 1].date >= WHATS_NEW[i].date).toBe(true);
    }
  });

  it("has English and Swedish text for every item and only studio targets", () => {
    for (const item of WHATS_NEW.flatMap((entry) => entry.items)) {
      expect(en.messages[item.text].trim()).not.toBe("");
      expect(sv.messages[item.text].trim()).not.toBe("");
      if (item.href) expect(item.href).toMatch(/^\/studio(\/|$)/);
    }
  });

  it("compares versions numerically", () => {
    expect(compareVersions("0.10.0", "0.9.0")).toBe(1);
    expect(compareVersions("0.7.0", "0.7.0")).toBe(0);
    expect(compareVersions("0.6.1", "0.7.0")).toBe(-1);
  });
});

describe("seen and unseen", () => {
  it("is unseen for a new device or an older version, seen once the latest is known", () => {
    const latest = latestVersion() as string;
    expect(hasUnseen(null)).toBe(true);
    expect(hasUnseen("0.1.0")).toBe(true);
    expect(hasUnseen(latest)).toBe(false);
    expect(hasUnseen("99.0.0")).toBe(false);
    expect(hasUnseen(null, [])).toBe(false);
  });

  it("remembers the latest version per device", () => {
    const store: Record<string, string> = {};
    vi.stubGlobal("window", { dispatchEvent: () => true });
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
    });
    expect(readLastSeen()).toBeNull();
    markSeen();
    expect(store[SEEN_KEY]).toBe(latestVersion());
    expect(hasUnseen(readLastSeen())).toBe(false);
  });

  it("survives blocked storage", () => {
    vi.stubGlobal("window", { dispatchEvent: () => true });
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    });
    expect(readLastSeen()).toBeNull();
    expect(() => markSeen()).not.toThrow();
  });
});
