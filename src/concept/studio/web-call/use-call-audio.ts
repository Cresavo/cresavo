"use client";

import { useEffect, useRef, type RefObject } from "react";
import { rmsLevel, smoothLevel } from "./call-levels";

// Live WebAudio levels for the call visualizer, and a short, quiet ring
// while the call is connecting. The ring is skipped when the microphone is
// muted, when the visitor prefers reduced motion, or in screenshot previews.
// Levels stay on a ref so the visualizer can read them each frame without
// rerendering the call screen.

export interface CallLevels {
  maja: number;
  caller: number;
  bins: Uint8Array | null;
}

export const SILENT_LEVELS: CallLevels = { maja: 0, caller: 0, bins: null };

function openAudioContext(): AudioContext | null {
  if (typeof AudioContext === "undefined") return null;
  try {
    return new AudioContext();
  } catch {
    return null;
  }
}

export function useCallAudio({
  speaker,
  microphone,
  ringing,
  active,
  muted,
  preview,
}: {
  speaker: RefObject<HTMLAudioElement | null>;
  microphone: MediaStream | null;
  ringing: boolean;
  active: boolean;
  muted: boolean;
  preview?: boolean;
}): RefObject<CallLevels> {
  const levels = useRef<CallLevels>(SILENT_LEVELS);

  useEffect(() => {
    if (preview) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!ringing || muted || reduce) return;
    const ctx = openAudioContext();
    if (!ctx) return;
    void ctx.resume();
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.04, now + 0.04);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);
    master.connect(ctx.destination);
    const tones = [523.25, 659.25];
    for (const [index, frequency] of tones.entries()) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = frequency;
      const gain = ctx.createGain();
      const start = now + index * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.8, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + 0.44);
    }
    return () => {
      void ctx.close();
    };
  }, [muted, preview, ringing]);

  useEffect(() => {
    if (preview || !active) {
      levels.current = SILENT_LEVELS;
      return;
    }
    const ctx = openAudioContext();
    if (!ctx) {
      levels.current = SILENT_LEVELS;
      return;
    }
    void ctx.resume();
    const majaAnalyser = ctx.createAnalyser();
    const callerAnalyser = ctx.createAnalyser();
    majaAnalyser.fftSize = 256;
    callerAnalyser.fftSize = 256;
    majaAnalyser.smoothingTimeConstant = 0.7;
    callerAnalyser.smoothingTimeConstant = 0.7;
    const majaTime = new Uint8Array(majaAnalyser.fftSize);
    const callerTime = new Uint8Array(callerAnalyser.fftSize);
    const majaBins = new Uint8Array(majaAnalyser.frequencyBinCount);
    let majaSource: MediaStreamAudioSourceNode | null = null;
    let callerSource: MediaStreamAudioSourceNode | null = null;
    let remoteKey = "";
    let frame = 0;
    let stopped = false;

    const attachRemote = () => {
      const stream = speaker.current?.srcObject;
      if (!(stream instanceof MediaStream) || stream.getAudioTracks().length === 0) return;
      const key = stream.id + stream.getAudioTracks().map((track) => track.id).join();
      if (key === remoteKey) return;
      remoteKey = key;
      majaSource?.disconnect();
      majaSource = ctx.createMediaStreamSource(stream);
      majaSource.connect(majaAnalyser);
    };

    if (microphone && microphone.getAudioTracks().length > 0) {
      callerSource = ctx.createMediaStreamSource(microphone);
      callerSource.connect(callerAnalyser);
    }

    const tick = () => {
      if (stopped) return;
      attachRemote();
      majaAnalyser.getByteTimeDomainData(majaTime);
      callerAnalyser.getByteTimeDomainData(callerTime);
      majaAnalyser.getByteFrequencyData(majaBins);
      const previous = levels.current;
      levels.current = {
        maja: smoothLevel(previous.maja, rmsLevel(majaTime)),
        caller: smoothLevel(previous.caller, rmsLevel(callerTime)),
        bins: majaBins,
      };
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);

    return () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
      majaSource?.disconnect();
      callerSource?.disconnect();
      void ctx.close();
      levels.current = SILENT_LEVELS;
    };
  }, [active, microphone, preview, speaker]);

  return levels;
}
