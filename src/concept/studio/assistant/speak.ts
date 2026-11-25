"use client";

import { locale } from "../../i18n";

// Spoken text through the browser's speech synthesis, or a pre-rendered clip when
// the caller has one. Optional, only on request, and silent where neither is available.
// Nothing is recorded.

let clip: HTMLAudioElement | null = null;
/** Called when a clip is cut off, so the brief can leave the "Stop reading" state. */
let clipEnd: (() => void) | null = null;

function releaseClip() {
  if (!clip) return;
  const audio = clip;
  const ended = clipEnd;
  clip = null;
  clipEnd = null;
  audio.onended = null;
  audio.onerror = null;
  audio.pause();
  audio.removeAttribute("src");
  try {
    audio.load();
  } catch {
    // Clearing the source can throw in some test environments; the element is already released.
  }
  ended?.();
}

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

/** True when a pre-rendered clip can be used, or when the browser can read the text aloud. */
export function canPlaySpeech(clipUrl?: string | null): boolean {
  return Boolean(clipUrl) || canSpeak();
}

/** A voice for the language: the exact tag first (sv-SE), then the same language in any region (sv). */
export function pickVoice<V extends { lang: string }>(voices: readonly V[], language: string): V | undefined {
  const tag = (lang: string) => lang.toLowerCase().replace("_", "-");
  const wanted = tag(language);
  const base = wanted.split("-")[0];
  return voices.find((voice) => tag(voice.lang) === wanted) ?? voices.find((voice) => tag(voice.lang).split("-")[0] === base);
}

function speakSynthesis(text: string, onEnd?: () => void): boolean {
  if (!canSpeak() || !text.trim()) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = locale;
  const voice = pickVoice(synth.getVoices?.() ?? [], locale);
  if (voice) utterance.voice = voice;
  if (onEnd) {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onEnd();
    };
    utterance.onend = finish;
    utterance.onerror = finish;
  }
  synth.speak(utterance);
  return true;
}

/**
 * Reads the text aloud, cutting off anything already being read. When `clipUrl` is set,
 * plays that static file first and falls back to speech synthesis if it fails.
 * Playing a clip is not visual motion and still only starts when the caller asks
 * (the read-aloud button); reduced-motion preferences do not change that.
 * `onEnd` runs once when it finishes, is stopped or fails. Returns false when nothing was read.
 */
export function speak(text: string, onEnd?: () => void, clipUrl?: string | null): boolean {
  releaseClip();
  if (clipUrl && typeof Audio !== "undefined") {
    if (canSpeak()) window.speechSynthesis.cancel();
    const audio = new Audio(clipUrl);
    clip = audio;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (clip === audio) {
        clip = null;
        clipEnd = null;
      }
      onEnd?.();
    };
    clipEnd = finish;
    const fallback = () => {
      if (clip === audio) {
        // Speech continues via synthesis, so the brief must not be told it has ended yet.
        clipEnd = null;
        releaseClip();
      }
      if (!speakSynthesis(text, onEnd)) finish();
    };
    audio.onended = finish;
    audio.onerror = fallback;
    try {
      const started = audio.play();
      if (started && typeof started.then === "function") {
        started.catch(() => {
          if (done || clip !== audio) return;
          fallback();
        });
      }
      return true;
    } catch {
      fallback();
      return canSpeak() && Boolean(text.trim());
    }
  }
  return speakSynthesis(text, onEnd);
}

export function stopSpeaking() {
  releaseClip();
  if (canSpeak()) window.speechSynthesis.cancel();
}
