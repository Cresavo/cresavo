import { existsSync, readFileSync, statSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { morningBrief } from "@/concept/assistant/briefs";
import { createDemoState } from "@/concept/data/generate";
import {
  getActiveLocale,
  getVocabulary,
  setLocale,
  setVocabulary,
} from "@/concept/i18n";
import { packOf } from "@/concept/packs";
import { openingFor } from "@/concept/data/slots";
import { dayBookings } from "@/concept/selectors";
import { eveningRecap } from "@/concept/summary/day";
import {
  DEMO_BRIEF_DAY,
  EVENING_BRIEF_CLIP,
  MORNING_BRIEF_CLIP,
  RECORDED_EVENING_HIGHLIGHTS,
  RECORDED_EVENING_SUMMARY,
  RECORDED_MORNING_ITEMS,
  eveningBriefClipUrl,
  morningBriefClipUrl,
} from "@/concept/studio/assistant/demo-brief-audio";
import {
  canPlaySpeech,
  canSpeak,
  speak,
  stopSpeaking,
} from "@/concept/studio/assistant/speak";

const today = DEMO_BRIEF_DAY;
const morningClock = { today, minutes: 9 * 60 };
const base = createDemoState(today);
const lastEnd = Math.max(
  ...dayBookings(base, today).map(
    (booking) => booking.start + booking.duration,
  ),
);
const eveningClock = { today, minutes: lastEnd };

const previousLocale = getActiveLocale();
const previousVocabulary = getVocabulary();

function swedishDemo() {
  setLocale("sv");
  setVocabulary(packOf(base).vocabulary);
}

describe("recorded demo brief clips", () => {
  afterEach(() => {
    setLocale(previousLocale);
    setVocabulary(previousVocabulary);
    stopSpeaking();
    vi.unstubAllGlobals();
  });

  it("still matches the standard Swedish Salong Eko demo, on any day", () => {
    swedishDemo();
    const brief = morningBrief(base, morningClock);
    expect(brief.items.map((item) => item.text)).toEqual(
      RECORDED_MORNING_ITEMS.map(([, text]) => text),
    );
    expect(brief.items[1].id).toMatch(/^cancel-/);
    const recap = eveningRecap(base, eveningClock);
    expect(recap.summary).toBe(RECORDED_EVENING_SUMMARY);
    expect(recap.highlights).toEqual([...RECORDED_EVENING_HIGHLIGHTS]);
    for (const day of [
      "2026-11-16",
      "2026-11-18",
      "2026-11-21",
      "2026-11-26",
    ]) {
      const state = createDemoState(day);
      const morning = morningBrief(state, { today: day, minutes: 9 * 60 });
      expect(
        morningBriefClipUrl(
          morning,
          { today: day, minutes: 9 * 60 },
          state.generatedFor,
        ),
      ).toBe(MORNING_BRIEF_CLIP);
      const end = Math.max(
        ...dayBookings(state, day).map(
          (booking) => booking.start + booking.duration,
        ),
      );
      const evening = eveningRecap(state, { today: day, minutes: end });
      expect(
        eveningBriefClipUrl(evening, { today: day }, state.generatedFor),
      ).toBe(EVENING_BRIEF_CLIP);
    }
  });

  it("opens only the demo's tomorrow when that weekday is normally closed or shorter", () => {
    const saturday = createDemoState("2026-11-21");
    expect(openingFor(saturday.salon, "2026-11-22")).toEqual({ open: 9 * 60, close: 18 * 60 });
    expect(openingFor(saturday.salon, "2026-11-29")).toBeNull();
    const friday = createDemoState("2026-11-20");
    expect(openingFor(friday.salon, "2026-11-21")).toEqual({ open: 9 * 60, close: 18 * 60 });
    expect(openingFor(friday.salon, "2026-11-28")).toEqual({ open: 10 * 60, close: 15 * 60 });
  });

  it("offers the morning clip only for that Swedish morning brief", () => {
    swedishDemo();
    const brief = morningBrief(base, morningClock);
    expect(morningBriefClipUrl(brief, morningClock, base.generatedFor)).toBe(
      MORNING_BRIEF_CLIP,
    );
    setLocale("en");
    expect(
      morningBriefClipUrl(brief, morningClock, base.generatedFor),
    ).toBeNull();
    swedishDemo();
    expect(
      morningBriefClipUrl(
        brief,
        { today, minutes: 12 * 60 },
        base.generatedFor,
      ),
    ).toBeNull();
    expect(
      morningBriefClipUrl(
        brief,
        { today: "2026-11-26", minutes: 9 * 60 },
        base.generatedFor,
      ),
    ).toBeNull();
    expect(morningBriefClipUrl(brief, morningClock, "2026-11-26")).toBeNull();
    const withoutGaps = {
      ...brief,
      items: brief.items.filter((item) => item.id !== "gaps"),
    };
    expect(
      morningBriefClipUrl(withoutGaps, morningClock, base.generatedFor),
    ).toBeNull();
  });

  it("offers the evening clip only for that Swedish recap", () => {
    swedishDemo();
    const recap = eveningRecap(base, eveningClock);
    expect(eveningBriefClipUrl(recap, eveningClock, base.generatedFor)).toBe(
      EVENING_BRIEF_CLIP,
    );
    setLocale("en");
    expect(
      eveningBriefClipUrl(recap, eveningClock, base.generatedFor),
    ).toBeNull();
    swedishDemo();
    expect(
      eveningBriefClipUrl(recap, { today: "2026-11-26" }, base.generatedFor),
    ).toBeNull();
    expect(
      eveningBriefClipUrl(
        { ...recap, summary: "Dagens intäkter: 0 kr från 0 besök." },
        eveningClock,
        base.generatedFor,
      ),
    ).toBeNull();
    const otherDay = createDemoState("2026-11-26");
    const otherEnd = Math.max(
      ...dayBookings(otherDay, "2026-11-26").map(
        (booking) => booking.start + booking.duration,
      ),
    );
    const other = eveningRecap(otherDay, {
      today: "2026-11-26",
      minutes: otherEnd,
    });
    expect(
      eveningBriefClipUrl(
        other,
        { today: "2026-11-26" },
        otherDay.generatedFor,
      ),
    ).toBe(EVENING_BRIEF_CLIP);
  });

  it("keeps the pre-rendered clips as small local mp3 files, with no runtime TTS in the source", () => {
    const morning = new URL(
      "../public/demo/brief/morning-elin.mp3",
      import.meta.url,
    );
    const evening = new URL(
      "../public/demo/brief/evening-elin.mp3",
      import.meta.url,
    );
    expect(existsSync(morning)).toBe(true);
    expect(existsSync(evening)).toBe(true);
    expect(statSync(morning).size).toBeGreaterThan(50_000);
    expect(statSync(morning).size).toBeLessThan(400_000);
    expect(statSync(evening).size).toBeGreaterThan(50_000);
    expect(statSync(evening).size).toBeLessThan(400_000);
    const source = [
      readFileSync(
        new URL(
          "../src/concept/studio/assistant/demo-brief-audio.ts",
          import.meta.url,
        ),
        "utf8",
      ),
      readFileSync(
        new URL("../src/concept/studio/assistant/speak.ts", import.meta.url),
        "utf8",
      ),
      readFileSync(
        new URL(
          "../src/concept/studio/today/morning-brief.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFileSync(
        new URL(
          "../src/concept/studio/today/evening-summary.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
    ].join("\n");
    expect(source).not.toMatch(
      /api\.elevenlabs|api\.openai|ELEVENLABS_API_KEY|OPENAI_API_KEY/,
    );
  });
});

describe("speech with a pre-rendered clip", () => {
  class Utterance {
    lang = "";
    voice: unknown = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public text: string) {}
  }

  let playClip: () => Promise<void> = () => Promise.resolve();

  class FakeAudio {
    static instances: FakeAudio[] = [];
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    play = vi.fn(() => playClip());
    pause = vi.fn();
    load = vi.fn();
    removeAttribute = vi.fn();
    constructor(public src: string) {
      FakeAudio.instances.push(this);
    }
  }

  function mockWorld(
    options: { speech?: boolean; play?: () => Promise<void> } = {},
  ) {
    FakeAudio.instances = [];
    playClip = options.play ?? (() => Promise.resolve());
    const spoken: Utterance[] = [];
    const synth = {
      cancel: vi.fn(),
      speak: vi.fn((utterance: Utterance) => spoken.push(utterance)),
      getVoices: () => [],
    };
    const window: Record<string, unknown> = { Audio: FakeAudio };
    if (options.speech !== false) {
      window.speechSynthesis = synth;
      window.SpeechSynthesisUtterance = Utterance;
    }
    vi.stubGlobal("window", window);
    vi.stubGlobal("Audio", FakeAudio);
    if (options.speech !== false)
      vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
    return { synth, spoken };
  }

  afterEach(() => {
    stopSpeaking();
    vi.unstubAllGlobals();
  });

  it("plays the clip and does not start the browser voice", () => {
    const { synth } = mockWorld();
    const onEnd = vi.fn();
    expect(speak("Morgonöversikt.", onEnd, MORNING_BRIEF_CLIP)).toBe(true);
    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].src).toBe(MORNING_BRIEF_CLIP);
    expect(FakeAudio.instances[0].play).toHaveBeenCalledTimes(1);
    expect(synth.speak).not.toHaveBeenCalled();
    FakeAudio.instances[0].onended?.();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("falls back to the browser voice when the clip cannot be played", async () => {
    const { spoken } = mockWorld({
      play: () => Promise.reject(new Error("failed to play")),
    });
    const onEnd = vi.fn();
    expect(speak("Morgonöversikt.", onEnd, MORNING_BRIEF_CLIP)).toBe(true);
    await vi.waitFor(() => expect(spoken).toHaveLength(1));
    expect(spoken[0].text).toBe("Morgonöversikt.");
    expect(onEnd).not.toHaveBeenCalled();
    spoken[0].onend?.();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("lets the button stay when a clip is available, even without speech synthesis", () => {
    mockWorld({ speech: false });
    expect(canSpeak()).toBe(false);
    expect(canPlaySpeech(null)).toBe(false);
    expect(canPlaySpeech(MORNING_BRIEF_CLIP)).toBe(true);
    expect(speak("Morgonöversikt.", undefined, MORNING_BRIEF_CLIP)).toBe(true);
    expect(FakeAudio.instances).toHaveLength(1);
  });

  it("stops the clip when asked to stop", () => {
    mockWorld();
    speak("Morgonöversikt.", undefined, MORNING_BRIEF_CLIP);
    const audio = FakeAudio.instances[0];
    stopSpeaking();
    expect(audio.pause).toHaveBeenCalled();
    expect(audio.removeAttribute).toHaveBeenCalledWith("src");
  });

  it("tells the brief it has ended when later speech cuts the clip off", () => {
    const { spoken } = mockWorld();
    const onEnd = vi.fn();
    expect(speak("Morgonöversikt.", onEnd, MORNING_BRIEF_CLIP)).toBe(true);
    const audio = FakeAudio.instances[0];
    expect(speak("Första kunden är Marie.")).toBe(true);
    expect(audio.pause).toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(spoken).toHaveLength(1);
    expect(spoken[0].text).toBe("Första kunden är Marie.");
    spoken[0].onend?.();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});
