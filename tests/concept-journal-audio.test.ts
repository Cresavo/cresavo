import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { runTask } from "@/concept/ai/run-task";
import { structureJournalTask } from "@/concept/ai/tasks/structure-journal";
import { MAX_AUDIO_BYTES, checkAudioFile, recorderMime, sniffAudio, type DurationProbe } from "@/concept/journals/audio-file";
import { beyondLimit, indexedDbAudioStore, memoryAudioStore, type JournalAudioStore, type JournalRecording } from "@/concept/journals/audio-store";

// Journal audio in the concept demo: what a file is by its bytes, the size and
// length limits, the last five per customer, and that structuring sees text only.
// All bytes below are hand-made headers, not real recordings.

const bytes = (...parts: (string | number[] | Uint8Array)[]) =>
  new Blob(parts.map((part) => (typeof part === "string" ? Uint8Array.from(part, (c) => c.charCodeAt(0)) : Uint8Array.from(part))));
const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const box = (type: string, ...body: number[][]) => {
  const content = body.flat();
  return [...u32(8 + content.length), ...Array.from(type, (c) => c.charCodeAt(0)), ...content];
};
const hdlr = (handler: string) => box("hdlr", [0, 0, 0, 0, 0, 0, 0, 0], Array.from(handler, (c) => c.charCodeAt(0)), new Array(12).fill(0));
const trak = (handler: string) => box("trak", box("mdia", hdlr(handler)));
const ftyp = (brand: string) => box("ftyp", Array.from(`${brand}\0\0\0\0${brand}`, (c) => c.charCodeAt(0)));
const ogg = (packet: string) => bytes("OggS", new Array(22).fill(0), [1, packet.length], packet);
const webm = (...codecs: string[]) => bytes([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x84], "webm", ...codecs.flatMap((codec) => [[0x86, 0x80 | codec.length], codec]));

const fixtures: Record<string, Blob> = {
  wav: bytes("RIFF", u32(36), "WAVEfmt "),
  flac: bytes("fLaC", [0, 0, 0, 34]),
  opus: ogg("OpusHead"),
  vorbis: ogg("\x01vorbis"),
  webm: webm("A_OPUS"),
  mp3: bytes([0xff, 0xfb, 0x90, 0x00]),
  id3: bytes("ID3", [4, 0, 0, 0, 0, 0, 2], new Array(2).fill(0), [0xff, 0xfb, 0x90, 0x00]),
  voiceMemo: bytes(ftyp("M4A "), box("moov", trak("soun"))),
  androidMoovLast: bytes(ftyp("mp42"), box("mdat", new Array(64).fill(7)), box("moov", trak("soun"))),
};

describe("journal audio file check", () => {
  it.each([
    ["wav", "wav"], ["flac", "flac"], ["opus", "ogg"], ["vorbis", "ogg"], ["webm", "webm"],
    ["mp3", "mp3"], ["id3", "mp3"], ["voiceMemo", "m4a"], ["androidMoovLast", "m4a"],
  ])("recognises %s by its bytes", async (name, kind) => expect(await sniffAudio(fixtures[name])).toBe(kind));

  it.each([
    ["a Windows executable named .m4a", bytes("MZ", new Array(60).fill(0))],
    ["an ELF binary", bytes("\x7fELF", [2, 1, 1])],
    ["a zip archive", bytes("PK\x03\x04", [20, 0])],
    ["a PDF", bytes("%PDF-1.7\n")],
    ["an MP4 video with sound", bytes(ftyp("isom"), box("moov", trak("vide"), trak("soun")))],
    ["an MP4 without tracks", bytes(ftyp("M4A "), box("mdat", [1, 2, 3]))],
    ["a 3GP recording", bytes(ftyp("3gp4"), box("moov", trak("soun")))],
    ["a WebM video", webm("V_VP9", "A_OPUS")],
    ["a Matroska file", bytes([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x88], "matroska", [0x86, 0x86], "A_OPUS")],
    ["an Ogg Theora video", ogg("\x80theora")],
    ["raw ADTS AAC", bytes([0xff, 0xf1, 0x50, 0x80])],
    ["an ID3 tag over something else", bytes("ID3", [4, 0, 0, 0, 0, 0, 0], "MZ")],
    ["plain text", bytes("Did the usual foot care.")],
  ])("refuses %s", async (_, blob) => expect(await sniffAudio(blob)).toBeNull());

  const lasting = (seconds: number): DurationProbe => async () => seconds;

  it("accepts an audio file within the limits and types it by its bytes", async () => {
    const named = new File([fixtures.voiceMemo], "visit.mp3", { type: "video/mp4" });
    expect(await checkAudioFile(named, lasting(600))).toEqual({ ok: true, kind: "m4a", mime: "audio/mp4", seconds: 600 });
  });

  it("refuses a file over 20 MB before reading it", async () => {
    let probed = false;
    const big = new Blob([fixtures.wav, new Uint8Array(MAX_AUDIO_BYTES)]);
    expect(await checkAudioFile(big, async () => ((probed = true), 1))).toEqual({ ok: false, reason: "tooLarge" });
    expect(probed).toBe(false);
    expect((await checkAudioFile(new Blob([fixtures.wav, new Uint8Array(MAX_AUDIO_BYTES - fixtures.wav.size)]), lasting(1))).ok).toBe(true);
  });

  it("refuses a recording over ten minutes, an empty file, the wrong type and a length it cannot read", async () => {
    expect(await checkAudioFile(fixtures.mp3, lasting(600.5))).toEqual({ ok: false, reason: "tooLong" });
    expect(await checkAudioFile(new Blob([]), lasting(1))).toEqual({ ok: false, reason: "empty" });
    expect(await checkAudioFile(new File(["MZ"], "memo.m4a", { type: "audio/mp4" }), lasting(1))).toEqual({ ok: false, reason: "wrongType" });
    expect(await checkAudioFile(fixtures.webm, lasting(Number.POSITIVE_INFINITY))).toEqual({ ok: false, reason: "unreadable" });
    expect(await checkAudioFile(fixtures.webm, async () => { throw new Error("decode"); })).toEqual({ ok: false, reason: "unreadable" });
  });

  it("records Opus in WebM where it can, MP4 on Safari, and lets the browser choose otherwise", () => {
    expect(recorderMime(() => true)).toBe("audio/webm;codecs=opus");
    expect(recorderMime((mime) => mime === "audio/mp4")).toBe("audio/mp4");
    expect(recorderMime(() => false)).toBe("");
  });
});

const recording = (id: string, customerId: string, createdAt: number, extra: Partial<JournalRecording> = {}): JournalRecording => ({
  id, customerId, createdAt, source: "recorded", mime: "audio/webm", seconds: 30, bytes: new Uint8Array([1, 2, 3]).buffer, ...extra,
});

describe.each<[string, () => JournalAudioStore]>([
  ["in memory", memoryAudioStore],
  ["in IndexedDB", () => indexedDbAudioStore(new IDBFactory())],
])("journal recordings %s", (_, make) => {
  it("keeps the last five per customer and drops the oldest when a sixth arrives", async () => {
    const store = make();
    for (let i = 1; i <= 5; i++) expect(await store.add(recording(`a${i}`, "anna", i * 1000))).toEqual([]);
    await store.add(recording("b1", "bo", 500));
    expect(await store.add(recording("a6", "anna", 6000, { source: "uploaded", mime: "audio/mp4" }))).toEqual(["a1"]);
    expect((await store.list("anna")).map((r) => r.id)).toEqual(["a6", "a5", "a4", "a3", "a2"]);
    expect((await store.list("bo")).map((r) => r.id)).toEqual(["b1"]);
  });

  it("keeps the bytes, a transcript added later, and forgets a customer on erasure", async () => {
    const store = make();
    await store.add(recording("a1", "anna", 1));
    await store.add(recording("b1", "bo", 2));
    await store.setTranscript("a1", "Did the usual foot care.");
    const [kept] = await store.list("anna");
    expect(kept.transcript).toBe("Did the usual foot care.");
    expect([...new Uint8Array(kept.bytes)]).toEqual([1, 2, 3]);
    await store.removeCustomer("anna");
    expect(await store.list("anna")).toEqual([]);
    expect(await store.list("bo")).toHaveLength(1);
  });
});

describe("journal audio retention rule", () => {
  it("names only what is beyond the newest five", () => {
    const rows = [3, 1, 6, 2, 5, 4, 7].map((n) => recording(`r${n}`, "anna", n));
    expect(beyondLimit(rows)).toEqual(["r2", "r1"]);
    expect(beyondLimit(rows.slice(0, 5))).toEqual([]);
  });
});

describe("structuring a transcript", () => {
  it("takes text only: an audio field is refused", () => {
    expect(structureJournalTask.input.safeParse({ transcript: "Did the usual foot care." }).success).toBe(true);
    expect(structureJournalTask.input.safeParse({ transcript: "Did the usual foot care.", audio: "UklGRg==" }).success).toBe(false);
    expect(structureJournalTask.input.safeParse({ audio: new Uint8Array([1]) }).success).toBe(false);
  });

  it("structures a transcript from a recording the same way as typed text", async () => {
    const transcript = "Did the usual foot care. Noticed dry skin on both heels. Recommend cream every evening. Next visit in 6 weeks.";
    expect((await runTask("structure-journal", { transcript }, { env: {} })).output).toEqual({
      treatment: "Did the usual foot care.",
      observations: "Noticed dry skin on both heels.",
      recommendation: "Recommend cream every evening.",
      nextVisit: "Next visit in 6 weeks.",
    });
  });
});
