"use client";

import { locale } from "../../i18n";

// Spoken text through the browser's speech synthesis. Optional, only on request,
// and silent where the browser has no speech synthesis.

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

/** A voice for the language: the exact tag first (sv-SE), then the same language in any region (sv). */
export function pickVoice<V extends { lang: string }>(voices: readonly V[], language: string): V | undefined {
  const tag = (lang: string) => lang.toLowerCase().replace("_", "-");
  const wanted = tag(language);
  const base = wanted.split("-")[0];
  return voices.find((voice) => tag(voice.lang) === wanted) ?? voices.find((voice) => tag(voice.lang).split("-")[0] === base);
}

/**
 * Reads the text aloud, cutting off anything already being read. `onEnd` runs once when it finishes,
 * is stopped or fails. Returns false when nothing was read.
 */
export function speak(text: string, onEnd?: () => void): boolean {
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

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}
