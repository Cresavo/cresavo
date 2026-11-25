import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { reduce } from "@/concept/actions";
import { noticeItems } from "@/concept/assistant/brief-notices";
import { briefSpeech, eventReactions, morningBrief, type Brief } from "@/concept/assistant/briefs";
import { addDays } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";
import { freeStarts } from "@/concept/data/slots";
import type { DemoState, InboxItem } from "@/concept/data/types";
import { t } from "@/concept/i18n";
import { formatDayLong, formatMoney, formatTime } from "@/concept/i18n/format";
import { fullName } from "@/concept/selectors";
import { pickVoice, speak, stopSpeaking } from "@/concept/studio/assistant/speak";
import { MorningBriefView } from "@/concept/studio/today/morning-brief";
import { payAtSalon } from "./helpers/pay-at-salon";

// The morning brief on Today and its read-aloud button. Rules only, fictional data only.
// Tuesday 17 November 2026, 09:00: the demo is generated for this day.

const today = "2026-11-17";
const clock = { today, minutes: 9 * 60 };
const base = createDemoState(today);
const service = base.services.find((s) => s.id === "medical-foot-care")!;
const guest = { name: "Lisa Fiktivsson", phone: "073-555 01 99", email: "lisa.fiktiv@example.invalid", at: { date: today, time: 8 * 60 } };

/** An unread booking-page event on a booking, as the booking page leaves it in the inbox. */
const event = (state: DemoState, id: string, bookingId: string, kind: InboxItem["event"], body = ""): DemoState => ({
  ...state,
  inbox: [{ id, kind: "request", bookingId, event: kind, date: today, time: 8 * 60, title: "Online", body, read: false, handled: false }, ...state.inbox],
});

/** The demo with a fictional guest who booked online on the first day after today with a free time. */
function bookedOnline() {
  const start = payAtSalon(base);
  const free = (date: string) => freeStarts(start, "anna", date, { serviceId: service.id, duration: service.duration }, { step: 30 })[0];
  const date = Array.from({ length: 30 }, (_, i) => addDays(today, i + 1)).find((day) => free(day) !== undefined)!;
  const slot = free(date);
  const state = reduce(start, { type: "online/book", serviceId: service.id, staffId: "anna", date, start: slot, guest, notice: { title: "New online booking", body: "Demo visit" } });
  return { state, visit: state.bookings.at(-1)! };
}

describe("morning brief", () => {
  it("still comes from rules, most important first, with the day's bookings and free slots", () => {
    const brief = morningBrief(base, clock);
    const ids = brief.items.map((item) => item.id);
    expect(ids).toEqual(expect.arrayContaining(["bookings", "gaps"]));
    expect(brief.items.map((i) => i.priority)).toEqual([...brief.items.map((i) => i.priority)].sort((a, b) => b - a));
  });

  it("has no booking-page notices on a fresh demo", () => {
    expect(noticeItems(base, clock)).toEqual([]);
    expect(morningBrief(base, clock).items.some((item) => item.id.startsWith("notice-"))).toBe(false);
  });

  it("names an online booking by first name, service, day and time, and leaves out the rest of the guest", () => {
    const { state, visit } = bookedOnline();
    const customer = state.customers.find((c) => c.id === visit.customerId)!;
    const journaled = reduce(state, { type: "journal/add", entry: { customerId: customer.id, date: today, staffId: "anna", treatment: "Fictional treatment note", observations: "Fictional observation", advice: "Fictional advice" } });
    const brief = morningBrief(journaled, clock);
    const item = brief.items.find((i) => i.id.startsWith("notice-"))!;
    const day = visit.date === addDays(today, 1) ? "tomorrow" : formatDayLong(visit.date);
    expect(item.text).toBe(`Lisa booked ${service.name} for ${day} at ${formatTime(visit.start)}.`);
    expect(item.href).toBe(`/studio/calendar?booking=${visit.id}`);
    const spoken = briefSpeech(brief);
    for (const text of [item.text, spoken]) {
      for (const secret of ["Fiktivsson", fullName(customer), guest.phone, guest.email, "Demo visit", "Fictional", formatMoney(service.price)]) expect(text).not.toContain(secret);
    }
    expect(spoken).toContain(item.text);
  });

  it("lists moves and cancellations, and gives up the line once read", () => {
    const { state, visit } = bookedOnline();
    const moved = event(state, "fictional-move", visit.id, "moved", "Fictional body with 073-555 01 99");
    const texts = morningBrief(moved, clock).items.map((i) => i.text);
    expect(texts.some((text) => text.startsWith("Lisa moved"))).toBe(true);
    expect(texts.join(" ")).not.toContain("073-555");
    const read = { ...moved, inbox: moved.inbox.map((i) => ({ ...i, read: true })) };
    expect(noticeItems(read, clock)).toEqual([]);
  });

  it("keeps notices ahead of the item cap, and counts any past the first two", () => {
    const { state, visit } = bookedOnline();
    const many = ["a", "b", "c", "d"].reduce((s, id) => event(s, `fictional-${id}`, visit.id, "moved"), state);
    const notices = noticeItems(many, clock);
    expect(notices.map((n) => n.id)).toEqual(["notice-fictional-d", "notice-fictional-c", "notice-more"]);
    expect(notices[2].text).toBe("3 more changes from the booking page.");
    const ids = morningBrief(many, clock).items.map((i) => i.id);
    for (const notice of notices) expect(ids).toContain(notice.id);
  });

  it("says a cancellation once when the booking page reported it and the slot is free", () => {
    const cancelled = base.bookings.find((b) => b.date === today && b.status === "cancelled" && eventReactions(base, clock).some((i) => i.id === `cancel-${b.id}`))!;
    expect(morningBrief(base, clock).items.map((i) => i.id)).toContain(`cancel-${cancelled.id}`);
    const reported = event(base, "fictional-cancel", cancelled.id, "cancelled");
    const ids = morningBrief(reported, clock).items.map((i) => i.id);
    expect(ids).toContain("notice-fictional-cancel");
    expect(ids).not.toContain(`cancel-${cancelled.id}`);
  });
});

describe("brief speech", () => {
  const brief: Brief = { kind: "morning", title: "Morning brief", items: [
    { id: "a", text: "3 bookings today, first at 09:00 with Anna.", priority: 4 },
    { id: "b", text: "Christmas is in 5 days: time for a campaign?", priority: 2 },
    { id: "c", text: "No full stop here", priority: 1 },
  ] };

  it("reads the title and each item as its own sentence, adding nothing", () => {
    expect(briefSpeech(brief)).toBe("Morning brief. 3 bookings today, first at 09:00 with Anna. Christmas is in 5 days: time for a campaign? No full stop here.");
  });

  it("says the day is quiet when there is nothing to say", () => {
    expect(briefSpeech({ ...brief, items: [] })).toBe(`Morning brief. ${t("assistant.brief.quiet")}`);
  });

  it("speaks the demo's morning brief from its own items only", () => {
    const morning = morningBrief(base, clock);
    const words = [morning.title, ...morning.items.map((i) => i.text)].join(" ");
    expect(briefSpeech(morning).replace(/\.(?= |$)/g, "")).toBe(words.replace(/\.(?= |$)/g, ""));
  });
});

describe("speech synthesis", () => {
  class Utterance {
    lang = "";
    voice: unknown = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public text: string) {}
  }

  function mockSynth(voices: { lang: string; name: string }[]) {
    const calls: string[] = [];
    const spoken: Utterance[] = [];
    const synth = {
      cancel: vi.fn(() => calls.push("cancel")),
      speak: vi.fn((u: Utterance) => { calls.push("speak"); spoken.push(u); }),
      getVoices: () => voices,
    };
    vi.stubGlobal("window", { speechSynthesis: synth, SpeechSynthesisUtterance: Utterance });
    vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
    return { synth, calls, spoken };
  }

  afterEach(() => vi.unstubAllGlobals());

  it("picks the voice for the exact language first, then the same language elsewhere", () => {
    const voices = [{ lang: "en-GB" }, { lang: "sv_FI" }, { lang: "sv-SE" }];
    expect(pickVoice(voices, "sv-SE")).toBe(voices[2]);
    expect(pickVoice(voices, "sv")).toBe(voices[1]);
    expect(pickVoice(voices, "en-US")).toBe(voices[0]);
    expect(pickVoice(voices, "de-DE")).toBeUndefined();
    expect(pickVoice([], "sv-SE")).toBeUndefined();
  });

  it("cuts off what is being read, then reads the text with a matching voice", () => {
    const { calls, spoken } = mockSynth([{ lang: "fr-FR", name: "Fictional French" }, { lang: "en-US", name: "Fictional English" }]);
    expect(speak("Morning brief.")).toBe(true);
    expect(calls).toEqual(["cancel", "speak"]);
    expect(spoken[0].text).toBe("Morning brief.");
    expect(spoken[0].lang).toBeTruthy();
    expect(spoken[0].voice).toMatchObject({ name: "Fictional English" });
  });

  it("speaks with the language alone when the browser has no voices yet, and ends once", () => {
    const { spoken } = mockSynth([]);
    const onEnd = vi.fn();
    speak("Morning brief.", onEnd);
    expect(spoken[0].voice).toBeNull();
    spoken[0].onerror?.();
    spoken[0].onend?.();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("reads nothing without speech synthesis or without text", () => {
    const { synth } = mockSynth([]);
    expect(speak("   ")).toBe(false);
    expect(synth.speak).not.toHaveBeenCalled();
    stopSpeaking();
    expect(synth.cancel).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
    vi.stubGlobal("window", {});
    expect(speak("Morning brief.")).toBe(false);
  });
});

describe("morning brief card", () => {
  const brief = morningBrief(base, clock);
  const html = (props: Partial<Parameters<typeof MorningBriefView>[0]>) =>
    renderToStaticMarkup(createElement(MorningBriefView, { brief, speakable: true, speaking: false, onToggle: () => undefined, ...props }));

  it("shows the brief with a labelled read-aloud button that becomes a stop button", () => {
    const idle = html({});
    expect(idle).toContain('data-testid="morning-brief"');
    expect(idle).toContain(brief.title);
    for (const item of brief.items) expect(idle).toContain(item.text.replace(/'/g, "&#x27;"));
    expect(idle).toContain(t("brief.readAloud"));
    expect(idle).toContain('aria-pressed="false"');
    const reading = html({ speaking: true });
    expect(reading).toContain(t("brief.stopReading"));
    expect(reading).toContain('aria-pressed="true"');
  });

  it("keeps the text and drops the button where the browser cannot speak", () => {
    const silent = html({ speakable: false });
    expect(silent).not.toContain(t("brief.readAloud"));
    expect(silent).toContain(brief.items[0].text.replace(/'/g, "&#x27;"));
    expect(html({ brief: { ...brief, items: [] } })).toContain(t("assistant.brief.quiet"));
  });

  it("starts speech only from the button: rendering reads nothing, and the brief never calls a model", () => {
    const synth = { cancel: vi.fn(), speak: vi.fn(), getVoices: () => [] };
    vi.stubGlobal("window", { speechSynthesis: synth, SpeechSynthesisUtterance: class {} });
    html({});
    expect(synth.speak).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    const source = readFileSync(new URL("../src/concept/studio/today/morning-brief.tsx", import.meta.url), "utf8");
    expect(source).not.toMatch(/useBrief|runAiTask|phrase-brief/);
    // The only speak() call sits in the button's handler.
    expect(source.match(/\bspeak\(/g)).toHaveLength(1);
    expect(source).toMatch(/const toggle = useCallback\(\(\) => \{[\s\S]*speak\(briefSpeech\(brief\)/);
  });

});
