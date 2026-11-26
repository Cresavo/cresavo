// Checks a journal recording before the concept demo keeps it: size first,
// then what the bytes say it is (never the file name or Content-Type), then
// its length. Only audio in the formats below is accepted; video, archives,
// executables and everything else are refused.

export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
export const MAX_AUDIO_SECONDS = 10 * 60;

export type AudioKind = "m4a" | "mp3" | "wav" | "webm" | "ogg" | "flac";

/** The type the demo stores and plays a recording as, from its sniffed kind. */
export const AUDIO_MIME: Record<AudioKind, string> = {
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  webm: "audio/webm",
  ogg: "audio/ogg",
  flac: "audio/flac",
};

/** What the file picker offers; the bytes still decide. */
export const AUDIO_ACCEPT = "audio/*,.m4a,.mp3,.wav,.webm,.ogg,.oga,.opus,.flac";

export type AudioRejection = "empty" | "tooLarge" | "wrongType" | "tooLong" | "unreadable";
export type AudioCheck = { ok: true; kind: AudioKind; mime: string; seconds: number } | { ok: false; reason: AudioRejection };

/** Reads how long a recording is, in seconds; NaN or Infinity when it cannot tell. */
export type DurationProbe = (blob: Blob, mime: string) => Promise<number>;

/** How much of the start of a file the sniffers look at. */
const HEAD_BYTES = 64 * 1024;
/** The largest MP4 `moov` box read to find its tracks. */
const MAX_MOOV_BYTES = 4 * 1024 * 1024;

const ascii = (bytes: Uint8Array, at: number, length: number) =>
  at + length <= bytes.length ? String.fromCharCode(...bytes.subarray(at, at + length)) : "";
const uint32 = (bytes: Uint8Array, at: number) =>
  at + 4 <= bytes.length ? ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0 : 0;

async function read(blob: Blob, start: number, length: number): Promise<Uint8Array> {
  return new Uint8Array(await blob.slice(start, start + length).arrayBuffer());
}

function indexOf(bytes: Uint8Array, text: string): number {
  const needle = Array.from(text, (c) => c.charCodeAt(0));
  outer: for (let i = 0; i + needle.length <= bytes.length; i++) {
    for (let j = 0; j < needle.length; j++) if (bytes[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

/** An MPEG audio Layer III frame header (MP3), not ADTS AAC (layer bits 00) or Layer I/II. */
const isMp3Frame = (bytes: Uint8Array, at: number) =>
  bytes[at] === 0xff && (bytes[at + 1] & 0xe0) === 0xe0 && ((bytes[at + 1] >> 1) & 3) === 1 && ((bytes[at + 1] >> 3) & 3) !== 1;

/** Ogg whose first stream is Opus, Vorbis or FLAC audio (not Theora video). */
function isOggAudio(head: Uint8Array): boolean {
  if (ascii(head, 0, 4) !== "OggS") return false;
  const packet = 27 + head[26];
  return ascii(head, packet, 8) === "OpusHead" || ascii(head, packet, 7) === "\x01vorbis" || ascii(head, packet, 5) === "\x7fFLAC";
}

/** WebM (not other Matroska) with an Opus or Vorbis track and no video track in its header. */
function isWebmAudio(head: Uint8Array): boolean {
  if (uint32(head, 0) !== 0x1a45dfa3) return false;
  const docType = indexOf(head, "\x42\x82");
  if (docType < 0 || ascii(head, docType + 3, 4) !== "webm") return false;
  if (["V_VP8", "V_VP9", "V_AV1", "V_MPEG"].some((codec) => indexOf(head, codec) >= 0)) return false;
  return indexOf(head, "A_OPUS") >= 0 || indexOf(head, "A_VORBIS") >= 0;
}

/** Walks the top-level MP4 boxes to `moov` and returns its bytes, or null. */
async function readMoov(blob: Blob): Promise<Uint8Array | null> {
  let at = 0;
  while (at + 8 <= blob.size) {
    const header = await read(blob, at, 16);
    let size = uint32(header, 0);
    const type = ascii(header, 4, 4);
    let body = 8;
    if (size === 1) {
      const high = uint32(header, 8);
      size = high * 2 ** 32 + uint32(header, 12);
      body = 16;
    } else if (size === 0) size = blob.size - at;
    if (size < body) return null;
    if (type === "moov") return size > MAX_MOOV_BYTES ? null : read(blob, at + body, size - body);
    at += size;
  }
  return null;
}

/** An MP4 container with at least one sound track and no video track: what Voice Memos and Android recorders write. */
async function isM4aAudio(blob: Blob, head: Uint8Array): Promise<boolean> {
  if (ascii(head, 4, 4) !== "ftyp" || ascii(head, 8, 2) === "3g") return false;
  const moov = await readMoov(blob);
  if (!moov) return false;
  const handlers: string[] = [];
  for (let at = indexOf(moov, "hdlr"); at >= 0; ) {
    // hdlr: type, version and flags (4), pre_defined (4), then the handler type.
    handlers.push(ascii(moov, at + 12, 4));
    const next = indexOf(moov.subarray(at + 4), "hdlr");
    at = next < 0 ? -1 : at + 4 + next;
  }
  return handlers.includes("soun") && !handlers.includes("vide");
}

/** What the bytes of a file say it is, or null when it is not an accepted audio format. */
export async function sniffAudio(blob: Blob): Promise<AudioKind | null> {
  const head = await read(blob, 0, HEAD_BYTES);
  if (ascii(head, 0, 4) === "RIFF" && ascii(head, 8, 4) === "WAVE") return "wav";
  if (ascii(head, 0, 4) === "fLaC") return "flac";
  if (isOggAudio(head)) return "ogg";
  if (isWebmAudio(head)) return "webm";
  if (ascii(head, 0, 3) === "ID3") {
    // ID3v2 size is four 7-bit bytes; the first MP3 frame follows the tag (and its footer, if flagged).
    const size = ((head[6] & 0x7f) << 21) | ((head[7] & 0x7f) << 14) | ((head[8] & 0x7f) << 7) | (head[9] & 0x7f);
    const frame = 10 + size + (head[5] & 0x10 ? 10 : 0);
    return isMp3Frame(await read(blob, frame, 4), 0) ? "mp3" : null;
  }
  if (isMp3Frame(head, 0)) return "mp3";
  if (await isM4aAudio(blob, head)) return "m4a";
  return null;
}

/** The whole check for an uploaded or recorded file. `probe` reads its length (the browser decodes it). */
export async function checkAudioFile(blob: Blob, probe: DurationProbe): Promise<AudioCheck> {
  if (blob.size === 0) return { ok: false, reason: "empty" };
  if (blob.size > MAX_AUDIO_BYTES) return { ok: false, reason: "tooLarge" };
  const kind = await sniffAudio(blob);
  if (!kind) return { ok: false, reason: "wrongType" };
  const mime = AUDIO_MIME[kind];
  const seconds = await probe(blob, mime).catch(() => Number.NaN);
  if (!Number.isFinite(seconds) || seconds <= 0) return { ok: false, reason: "unreadable" };
  if (seconds > MAX_AUDIO_SECONDS) return { ok: false, reason: "tooLong" };
  return { ok: true, kind, mime, seconds };
}

/** The recorder format to ask for: Opus in WebM where the browser has it, MP4 (Safari) otherwise, or the browser's own choice. */
export function recorderMime(isTypeSupported: (mime: string) => boolean): string {
  return ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"].find((mime) => isTypeSupported(mime)) ?? "";
}
