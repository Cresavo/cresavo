import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { respond } from "@/concept/assistant/engine";
import { deferChanges } from "@/concept/assistant/spoken-changes";
import { emptyContext } from "@/concept/assistant/thread";
import { buildIntentContext } from "@/concept/command/intent-context";
import { formatTime } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";
import { CONVERSATION_SILENCE_MS, createConversation, type ConversationPorts, type ConversationState } from "@/concept/studio/assistant/conversation";
import { safeSpeech, spokenReply } from "@/concept/studio/assistant/spoken-text";
import { setLocale } from "@/concept/i18n";
import { fullName } from "@/concept/selectors";

// The spoken conversation lab (CRS-F1 path a), without React or a microphone:
// the Labs switch is off until switched on, the conversation listens, reads
// and listens again, a spoken line never carries health, journal or contact
// details, and spoken words only ever become a proposal to approve on screen.

const storage = new Map<string, string>();

function stubWindow(extra: Record<string, unknown> = {}) {
  vi.stubGlobal("window", {
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => void storage.set(key, value) },
    addEventListener: () => {},
    removeEventListener: () => {},
    ...extra,
  });
}

beforeEach(() => {
  vi.resetModules();
  storage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe("Labs switch", () => {
  it("is off on the server", async () => {
    const { labFlag } = await import("@/concept/labs/flags");
    expect(labFlag("voiceAssistant")).toBe(false);
  });

  it("is off when nothing is saved, or what is saved cannot be read", async () => {
    stubWindow();
    expect((await import("@/concept/labs/flags")).labFlag("voiceAssistant")).toBe(false);
    vi.resetModules();
    storage.set("salong-eko-labs", "{not json");
    expect((await import("@/concept/labs/flags")).labFlag("voiceAssistant")).toBe(false);
    vi.resetModules();
    storage.set("salong-eko-labs", JSON.stringify({ voiceAssistant: "yes" }));
    expect((await import("@/concept/labs/flags")).labFlag("voiceAssistant")).toBe(false);
  });

  it("is off when the browser refuses storage", async () => {
    vi.stubGlobal("window", { localStorage: { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } } });
    const flags = await import("@/concept/labs/flags");
    expect(flags.labFlag("voiceAssistant")).toBe(false);
    // Switching on still works for this page.
    flags.setLabFlag("voiceAssistant", true);
    expect(flags.labFlag("voiceAssistant")).toBe(true);
  });

  it("is kept in this browser once switched on, and off again", async () => {
    stubWindow();
    const flags = await import("@/concept/labs/flags");
    flags.setLabFlag("voiceAssistant", true);
    expect(JSON.parse(storage.get("salong-eko-labs")!)).toEqual({ voiceAssistant: true });
    vi.resetModules();
    const reloaded = await import("@/concept/labs/flags");
    expect(reloaded.labFlag("voiceAssistant")).toBe(true);
    reloaded.setLabFlag("voiceAssistant", false);
    expect(reloaded.labFlag("voiceAssistant")).toBe(false);
  });
});

describe("recognition on the device", () => {
  class Recognizer {
    lang = "";
    continuous = false;
    interimResults = false;
    onresult = null;
    onerror = null;
    onend = null;
    start() {}
    stop() {}
    abort() {}
  }

  it("does not force on-device recognition just because the option exists", async () => {
    class Local extends Recognizer {
      processLocally = false;
    }
    stubWindow({ SpeechRecognition: Local });
    const speech = await import("@/concept/command/use-speech");
    const created = speech.createRecognition({ lang: "sv", continuous: false })!;
    expect(created.onDevice).toBe(false);
    expect(created.recognition.processLocally).toBe(false);
    expect(created.recognition).toMatchObject({ lang: "sv", continuous: false, interimResults: true });
  });

  it("asks for on-device recognition only after the browser says the language pack is already there", async () => {
    class Local extends Recognizer {
      processLocally = false;
      static available() {
        return Promise.resolve("available");
      }
    }
    stubWindow({ SpeechRecognition: Local });
    const speech = await import("@/concept/command/use-speech");
    expect(speech.createRecognition({ lang: "sv", continuous: false })!.onDevice).toBe(false);
    const first = await speech.prepareRecognition({ lang: "sv", continuous: false });
    expect(first!.onDevice).toBe(true);
    expect(first!.recognition.processLocally).toBe(true);
  });

  it("leaves recognition as it is when the language pack is only downloadable", async () => {
    class Local extends Recognizer {
      processLocally = false;
      static available() {
        return Promise.resolve("downloadable");
      }
    }
    stubWindow({ SpeechRecognition: Local });
    const speech = await import("@/concept/command/use-speech");
    await expect(speech.probeLocalSpeech("sv")).resolves.toBe("downloadable");
    const created = speech.createRecognition({ lang: "sv", continuous: false })!;
    expect(created.onDevice).toBe(false);
    expect(created.recognition.processLocally).toBe(false);
  });

  it("still listens where the browser has no such choice, and says nothing about the device", async () => {
    stubWindow({ webkitSpeechRecognition: Recognizer });
    const speech = await import("@/concept/command/use-speech");
    const created = speech.createRecognition({ lang: "en", continuous: true })!;
    expect(created.onDevice).toBe(false);
    expect("processLocally" in created.recognition).toBe(false);
    expect(created.recognition.continuous).toBe(true);
    expect(speech.recognisesOnDevice()).toBe(false);
  });

  it("has no recogniser where the browser has none", async () => {
    stubWindow();
    expect((await import("@/concept/command/use-speech")).createRecognition({ lang: "en", continuous: false })).toBeNull();
  });
});

/** A conversation over fake ports: a manual clock, a recorder of what was listened to, said and sent. */
function harness(options: { canSpeak?: boolean } = {}) {
  const log: string[] = [];
  const timers: { run: () => void; at: number }[] = [];
  let now = 0;
  let speaking: (() => void) | null = null;
  const states: ConversationState[] = [];
  const ports: ConversationPorts = {
    listen: () => void log.push("listen"),
    stopListening: () => void log.push("stop-listening"),
    speak: (text, done) => {
      if (options.canSpeak === false) return false;
      log.push(`speak:${text}`);
      speaking = done;
      return true;
    },
    stopSpeaking: () => {
      log.push("stop-speaking");
      // The browser reports a cancelled line as finished.
      const done = speaking;
      speaking = null;
      done?.();
    },
    send: (text) => void log.push(`send:${text}`),
    setTimer: (run, ms) => {
      const timer = { run, at: now + ms };
      timers.push(timer);
      return timer;
    },
    clearTimer: (handle) => void timers.splice(timers.indexOf(handle as (typeof timers)[number]), 1),
    onChange: (state) => void states.push(state),
  };
  const conversation = createConversation(ports);
  return {
    conversation,
    log,
    states,
    phase: () => conversation.state().phase,
    /** The browser finished reading the line aloud. */
    finishSpeaking: () => {
      const done = speaking;
      speaking = null;
      done?.();
    },
    advance(ms: number) {
      now += ms;
      for (const timer of timers.filter((t) => t.at <= now)) {
        timers.splice(timers.indexOf(timer), 1);
        timer.run();
      }
    },
  };
}

describe("spoken conversation", () => {
  it("listens, sends the words, reads the reply and listens again", () => {
    const h = harness();
    h.conversation.start();
    expect(h.phase()).toBe("listening");
    h.conversation.heard("  Who is coming today? ");
    expect(h.phase()).toBe("thinking");
    h.conversation.replied("Three bookings today.");
    expect(h.phase()).toBe("speaking");
    h.finishSpeaking();
    expect(h.phase()).toBe("listening");
    expect(h.log).toEqual(["listen", "stop-listening", "send:Who is coming today?", "speak:Three bookings today.", "listen"]);
  });

  it("listens again at once when muted, when there is nothing to say, or when the browser cannot speak", () => {
    const muted = harness();
    muted.conversation.start();
    muted.conversation.setMuted(true);
    muted.conversation.heard("hello");
    muted.conversation.replied("Hi.");
    expect(muted.phase()).toBe("listening");
    expect(muted.log.some((entry) => entry.startsWith("speak:"))).toBe(false);

    const silent = harness();
    silent.conversation.start();
    silent.conversation.heard("hello");
    silent.conversation.replied(null);
    expect(silent.phase()).toBe("listening");

    const noVoices = harness({ canSpeak: false });
    noVoices.conversation.start();
    noVoices.conversation.heard("hello");
    noVoices.conversation.replied("Hi.");
    expect(noVoices.phase()).toBe("listening");
  });

  it("reads aloud by default in a new conversation, even after the last one was muted", () => {
    const h = harness();
    h.conversation.start();
    h.conversation.setMuted(true);
    h.conversation.stop();
    h.conversation.start();
    expect(h.conversation.state().muted).toBe(false);
  });

  it("lets the owner interrupt a reply and speak", () => {
    const h = harness();
    h.conversation.start();
    h.conversation.heard("what is on tomorrow");
    h.conversation.replied("A long answer.");
    h.conversation.interrupt();
    expect(h.phase()).toBe("listening");
    expect(h.log.slice(-2)).toEqual(["stop-speaking", "listen"]);
    // The cut-off line finishing late does not start a second turn.
    h.finishSpeaking();
    expect(h.log.filter((entry) => entry === "listen")).toHaveLength(2);
  });

  it("ignores further words until it is listening again", () => {
    const h = harness();
    h.conversation.start();
    h.conversation.heard("first");
    h.conversation.heard("late from the same turn");
    expect(h.phase()).toBe("thinking");
    expect(h.log.filter((entry) => entry.startsWith("send:"))).toEqual(["send:first"]);
    h.conversation.replied("Reply.");
    h.conversation.heard("echo of the reply");
    expect(h.phase()).toBe("speaking");
    expect(h.log.filter((entry) => entry.startsWith("send:"))).toEqual(["send:first"]);
  });

  it("muting during a reply stops it and listens", () => {
    const h = harness();
    h.conversation.start();
    h.conversation.heard("first");
    h.conversation.replied("Reply.");
    h.conversation.setMuted(true);
    expect(h.phase()).toBe("listening");
  });

  it("ends after a quiet moment, listening on while the recogniser gives up sooner", () => {
    const h = harness();
    h.conversation.start();
    h.advance(CONVERSATION_SILENCE_MS / 2);
    h.conversation.listenEnded({ heard: false, error: "no-speech" });
    expect(h.phase()).toBe("listening");
    expect(h.log.filter((entry) => entry === "listen")).toHaveLength(2);
    h.advance(CONVERSATION_SILENCE_MS / 2);
    expect(h.conversation.state()).toMatchObject({ phase: "ended", ended: "silence" });
    expect(h.log.at(-1)).toBe("stop-speaking");
    expect(h.log).toContain("stop-listening");
    expect(CONVERSATION_SILENCE_MS).toBeGreaterThanOrEqual(15_000);
    expect(CONVERSATION_SILENCE_MS).toBeLessThanOrEqual(20_000);
  });

  it("starts the quiet moment again when words are still coming in", () => {
    const h = harness();
    h.conversation.start();
    h.advance(CONVERSATION_SILENCE_MS - 1000);
    h.conversation.hearing();
    h.advance(CONVERSATION_SILENCE_MS - 1000);
    expect(h.phase()).toBe("listening");
    h.advance(1000);
    expect(h.conversation.state()).toMatchObject({ phase: "ended", ended: "silence" });
  });

  it("ignores a late reply from a previous turn", () => {
    const h = harness();
    h.conversation.start();
    h.conversation.heard("first");
    const first = h.conversation.turn();
    h.conversation.stop();
    h.conversation.start();
    h.conversation.heard("second");
    h.conversation.replied("Old answer.", first);
    expect(h.phase()).toBe("thinking");
    expect(h.log.filter((entry) => entry.startsWith("speak:"))).toEqual([]);
    h.conversation.replied("New answer.", h.conversation.turn());
    expect(h.phase()).toBe("speaking");
    expect(h.log.filter((entry) => entry.startsWith("speak:"))).toEqual(["speak:New answer."]);
  });

  it("gives each turn its own quiet moment", () => {
    const h = harness();
    h.conversation.start();
    h.advance(CONVERSATION_SILENCE_MS - 1000);
    h.conversation.heard("hello");
    h.advance(5000);
    expect(h.phase()).toBe("thinking");
    h.conversation.replied(null);
    h.advance(CONVERSATION_SILENCE_MS - 1000);
    expect(h.phase()).toBe("listening");
    h.advance(1000);
    expect(h.phase()).toBe("ended");
  });

  it("ends when the microphone is refused", () => {
    const h = harness();
    h.conversation.start();
    h.conversation.listenEnded({ heard: false, error: "not-allowed" });
    expect(h.conversation.state()).toMatchObject({ phase: "ended", ended: "failed" });
  });

  it("does not start another listen when Stop aborts a pending probe", () => {
    const log: string[] = [];
    let conversation: ReturnType<typeof createConversation>;
    const ports: ConversationPorts = {
      listen: () => void log.push("listen"),
      stopListening: () => {
        log.push("stop-listening");
        conversation.listenEnded({ heard: false, error: "aborted" });
      },
      speak: () => false,
      stopSpeaking: () => void log.push("stop-speaking"),
      send: () => {},
      setTimer: () => 1,
      clearTimer: () => {},
      onChange: () => {},
    };
    conversation = createConversation(ports);
    conversation.start();
    conversation.stop();
    expect(conversation.state()).toMatchObject({ phase: "ended", ended: "stopped" });
    expect(log.filter((entry) => entry === "listen")).toEqual(["listen"]);
  });

  it("ends on a network failure instead of starting another listen", () => {
    const h = harness();
    h.conversation.start();
    h.conversation.listenEnded({ heard: false, error: "network" });
    expect(h.conversation.state()).toMatchObject({ phase: "ended", ended: "failed" });
    expect(h.log.filter((entry) => entry === "listen")).toEqual(["listen"]);
  });

  it("stops on Stop, on leaving the tab and on closing, and ignores a reply that arrives later", () => {
    const h = harness();
    h.conversation.start();
    h.conversation.heard("hello");
    h.conversation.stop();
    expect(h.conversation.state()).toMatchObject({ phase: "ended", ended: "stopped" });
    h.conversation.replied("Late reply.");
    expect(h.log.some((entry) => entry.startsWith("speak:"))).toBe(false);
    h.conversation.heard("anyone there?");
    expect(h.log.filter((entry) => entry.startsWith("send:"))).toHaveLength(1);

    h.conversation.start();
    h.conversation.stop("hidden");
    expect(h.conversation.state().ended).toBe("hidden");
    h.conversation.close();
    expect(h.phase()).toBe("off");
  });

  it("never starts by itself", () => {
    const h = harness();
    h.conversation.heard("hey assistant");
    h.conversation.listenEnded({ heard: false });
    h.advance(CONVERSATION_SILENCE_MS * 2);
    expect(h.log).toEqual([]);
    expect(h.phase()).toBe("off");
  });
});

describe("what is read aloud", () => {
  const state = createDemoState("2026-11-17");
  const customer = state.customers.find((c) => state.customers.filter((o) => o.firstName === c.firstName).length === 1)!;
  const journal = state.journals[0];

  afterEach(() => setLocale("en"));

  it("names a customer by first name only", () => {
    expect(safeSpeech(`${fullName(customer)} is next at 10:00.`, state)).toBe(`${customer.firstName} is next at 10:00.`);
    expect(safeSpeech(`Move ${fullName(customer)}'s booking.`, state)).toBe(`Move ${customer.firstName}'s booking.`);
    expect(safeSpeech(`Boka om besöket för ${fullName(customer)}s vän`, state)).toBe(`Boka om besöket för ${customer.firstName}s vän`);
    const unique = { ...customer, id: "spoken-unique", firstName: "Lina", lastName: "Kvickstrand" };
    const named = { ...state, customers: [...state.customers, unique] };
    expect(safeSpeech("Kvickstrand is next at 10:00.", named)).toBe("Lina is next at 10:00.");
    expect(safeSpeech("Move Kvickstrand's booking.", named)).toBe("Move Lina's booking.");
  });

  it("keeps a shared surname on the screen", () => {
    const other = { ...customer, id: "other-" + customer.id, firstName: "Other", lastName: customer.lastName };
    const shared = { ...state, customers: [...state.customers, other] };
    expect(safeSpeech(`${customer.lastName} is next at 10:00.`, shared)).toBe("The details are on the screen.");
    expect(safeSpeech(`${fullName(customer)} and ${fullName(other)} are next.`, shared)).toBe(`${customer.firstName} and ${other.firstName} are next.`);
  });

  it.each([
    ["an English health detail", "She has diabetes and a painful heel."],
    ["a Swedish health detail", "Hon har ont och svullnad i foten."],
    ["a Swedish health word with å, ä, ö", "Kunden har eksem och smärta."],
    ["a phone number", "Call her on 070-123 45 67."],
    ["a phone number in parentheses", "Call her on (070) 123-45-67."],
    ["a space-separated phone number", "070 123 45 67"],
    ["a formatted number without a leading zero", "Call her on (212) 555-1234."],
    ["an international phone number", "Ring +46 70 123 45 67."],
    ["an email", "Her email is lena@example.com."],
    ["an English address", "She lives at Storgatan 12."],
    ["a numbered English street", "She lives at 12 Main St."],
    ["an avenue", "The salon is at 12 Main Avenue."],
    ["a Swedish address", "Hon bor på Ringvägen 4."],
  ])("never reads %s", (_, text) => {
    expect(safeSpeech(text, state)).toBe("The details are on the screen.");
  });

  it("never reads journal text, whole or in part", () => {
    expect(safeSpeech(journal.treatment, state)).toBe("The details are on the screen.");
    const sentence = journal.observations.split(".")[0];
    expect(safeSpeech(`Last time: ${sentence}. Anything else?`, state)).toBe("The details are on the screen.");
    const withNote = { ...state, journals: [{ ...journal, observations: "Prefers a quiet room and a shorter appointment." }] };
    expect(safeSpeech("Last time she prefers a quiet room.", withNote)).toBe("The details are on the screen.");
    const short = { ...state, journals: [{ ...journal, treatment: "Visit", observations: "Uses gel", advice: "insulin", nextVisit: "In 8 weeks" }] };
    expect(safeSpeech("Uses gel on the nails.", short)).toBe("The details are on the screen.");
    expect(safeSpeech("She uses insulin.", short)).toBe("The details are on the screen.");
    const brief = { ...state, journals: [{ ...journal, treatment: "Visit", observations: "HIV", advice: "", nextVisit: "" }] };
    expect(safeSpeech("She has HIV.", brief)).toBe("The details are on the screen.");
  });

  it("reads a treatment's name, which is the salon's menu and not anyone's health", () => {
    const medical = state.services.find((s) => /medical|ingrown/i.test(s.name))!;
    expect(safeSpeech(`${medical.name} tomorrow at 10:00.`, state)).toBe(`${medical.name} tomorrow at 10:00.`);
    const withSameWords = { ...state, journals: [{ ...journal, treatment: medical.name, observations: "", advice: "", nextVisit: "" }] };
    expect(safeSpeech(`${medical.name} tomorrow at 10:00.`, withSameWords)).toBe(`${medical.name} tomorrow at 10:00.`);
    const eczema = { ...medical, id: "spoken-eczema", name: "Eczema" };
    const named = { ...state, services: [...state.services, eczema] };
    expect(safeSpeech("Eczema tomorrow at 10:00.", named)).toBe("Eczema tomorrow at 10:00.");
    expect(safeSpeech("She has eczema.", named)).toBe("The details are on the screen.");
  });

  it("does not read out a list of many customers", () => {
    const names = state.customers.slice(0, 5).map(fullName).join(", ");
    expect(safeSpeech(`Not back since summer: ${names}.`, state)).toBe("The details are on the screen.");
  });

  it("says the details are on the screen in Swedish too", () => {
    setLocale("sv");
    expect(safeSpeech("Ring 070-123 45 67.", state)).toBe("Detaljerna finns på skärmen.");
  });

  it("describes a proposal and points at the screen to approve it", () => {
    const line = spokenReply({ source: "rules", text: "I have drafted this for you to check.", card: { kind: "change", title: `Move ${fullName(customer)}'s booking`, rows: [{ label: "Phone", after: "070-123 45 67" }], action: { type: "inbox/read-all" }, toast: "" } }, state);
    expect(line).toBe(`I have drafted this for you to check. Move ${customer.firstName}'s booking. Approve it on the screen if it looks right.`);
  });

  it("reads nothing for an empty reply", () => {
    expect(spokenReply({ source: "rules", text: " " }, state)).toBeNull();
  });
});

describe("spoken words only propose", () => {
  const today = "2026-11-17";
  const clock = { today, minutes: 8 * 60 };
  const state = createDemoState(today);
  const input = (text: string) => ({ state, text, context: emptyContext(), clock, role: "owner" as const, examples: [] });

  it("turns a spoken 'remember' into an offer to tap, and 'forget' into a proposal", () => {
    const remembered = deferChanges(respond(input("Remember that the coffee machine is new")), state);
    expect(remembered.effects).toEqual([]);
    expect(remembered.reply.card).toMatchObject({ kind: "memory-offer" });

    const withNote = { ...state, memory: [{ id: "m1", text: "The coffee machine is new", kind: "fact" as const, savedOn: today, source: "owner" as const }] };
    const forgot = deferChanges(respond({ ...input("Forget the coffee machine"), state: withNote }), withNote);
    expect(forgot.effects).toEqual([]);
    expect(forgot.reply.card).toMatchObject({ kind: "change", action: { type: "memory/forget", id: "m1" }, destructive: true });
  });

  it("leaves a reply without changes as it was", () => {
    const outcome = respond(input("Who is coming today?"));
    expect(deferChanges(outcome, state)).toBe(outcome);
  });

  it("turns a spoken move into a proposal and changes nothing", () => {
    const booking = state.bookings.find((b) => b.status === "booked" && b.date > today && state.bookings.filter((o) => o.customerId === b.customerId && o.date === b.date).length === 1)!;
    const customer = state.customers.find((c) => c.id === booking.customerId)!;
    const before = structuredClone(state);
    const outcome = deferChanges(respond(input(`Move ${fullName(customer)} on ${booking.date} to ${booking.date} at ${formatTime(booking.start + 60)}`)), state);
    expect(outcome.effects).toEqual([]);
    expect(["change", "choose", "message"]).toContain(outcome.reply.card?.kind);
    expect(state).toEqual(before);
    expect(buildIntentContext(state, today, clock.minutes).bookings.find((b) => b.id === booking.id)).toBeTruthy();
  });

  it.each(["yes", "Yes, do it", "ja", "Ja, gör det", "approve", "godkänn"])("hearing %s approves nothing", (words) => {
    const outcome = deferChanges(respond(input(words)), state);
    expect(outcome.effects).toEqual([]);
    expect(outcome.reply.status).toBeUndefined();
    expect(outcome.reply.card?.kind).not.toBe("change");
  });
});
