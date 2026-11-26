import { afterEach, describe, expect, it } from "vitest";
import { beginLogo, cancelLogo, finishLogo, isLatestLogo, logoBusy, waitForLogo } from "@/concept/studio/onboarding/logo-queue";

afterEach(() => { cancelLogo(); });

describe("setup logo queue", () => {
  it("is idle until a logo is chosen, then busy until that pick finishes", async () => {
    expect(logoBusy()).toBe(false);
    const first = beginLogo();
    expect(logoBusy()).toBe(true);
    expect(isLatestLogo(first)).toBe(true);
    const waiting = waitForLogo();
    let done = false;
    void waiting.then(() => { done = true; });
    await Promise.resolve();
    expect(done).toBe(false);
    finishLogo(first);
    await waiting;
    expect(done).toBe(true);
    expect(logoBusy()).toBe(false);
  });

  it("drops an earlier pick when a newer one starts, so creating the salon waits only for the latest", async () => {
    const first = beginLogo();
    const second = beginLogo();
    expect(isLatestLogo(first)).toBe(false);
    expect(isLatestLogo(second)).toBe(true);
    finishLogo(first);
    expect(logoBusy()).toBe(true);
    const waiting = waitForLogo();
    finishLogo(second);
    await waiting;
    expect(logoBusy()).toBe(false);
  });

  it("lets creation continue when the owner leaves the look step mid-decode", async () => {
    beginLogo();
    const waiting = waitForLogo();
    cancelLogo();
    await waiting;
    expect(logoBusy()).toBe(false);
  });
});
