"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { CallRecord } from "../../receptionist/types";
import { PREVIEW_HANDOVER, PREVIEW_LINES } from "./ring-preview-lines";
import { useStudio } from "../use-studio";
import { ownerOf } from "./ring-page";
import { RingScreen } from "./ring-screen";
import { SILENT_LEVELS, type CallLevels } from "./use-call-audio";
import type { WebCallState } from "./use-web-call";
import { isWaveKind, type WaveKind } from "./waves";

// Mocked call states for screenshots. No realtime session, no paid API call.

function mockRecord(bookingId: string | undefined, outcome: CallRecord["outcome"], handoverReason?: string): CallRecord {
  return {
    id: "call-preview",
    channel: "browser-test",
    date: "2026-12-01",
    time: 14 * 60,
    durationSec: 84,
    outcome,
    endedBy: "receptionist",
    bookingId,
    customerId: undefined,
    handoverReason,
    costUsd: 0.18,
    transcript: PREVIEW_LINES,
  };
}

function RingPreviewBody() {
  const params = useSearchParams();
  const shot = params?.get("shot") ?? "idle";
  const wave: WaveKind = isWaveKind(params?.get("wave")) ? params!.get("wave") as WaveKind : "bars";
  const portraitSrc = params?.get("portrait") === "1" ? "/preview/maja.png" : undefined;
  const drive = params?.get("drive") === "1";
  const { state } = useStudio();
  const speaker = useRef<HTMLAudioElement>(null);
  const previewLevels = useRef<CallLevels>(SILENT_LEVELS);
  const [scene, setScene] = useState<"ringing" | "idle" | "maja" | "caller" | null>(drive ? "ringing" : null);
  const salonName = state.salon.name;
  const ownerName = ownerOf(state);
  const salon = useMemo(() => ({ salonName, language: "sv" as const, ownerName }), [salonName, ownerName]);
  const booked = state.bookings.find((item) => item.status === "booked") ?? state.bookings[0];
  const bookingId = booked?.id;
  const textDefault = shot === "live-text" || shot === "ended-text";
  const [showText, setShowText] = useState(textDefault);
  useEffect(() => {
    if (drive) return;
    previewLevels.current = shot.startsWith("live")
      ? { maja: 0.55, caller: 0.25, bins: null }
      : shot === "ringing"
        ? { maja: 0.2, caller: 0, bins: null }
        : SILENT_LEVELS;
  }, [drive, shot]);

  useEffect(() => {
    if (!drive) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let stopped = false;
    let ctx: AudioContext | null = null;
    let frame = 0;
    const timers: number[] = [];

    const setLevels = (maja: number, caller: number, bins: Uint8Array | null = null) => {
      previewLevels.current = { maja, caller, bins };
    };

    const play = async (url: string, into: "maja" | "caller") => {
      const response = await fetch(url);
      if (!response.ok || stopped) return;
      const buffer = await response.arrayBuffer();
      if (stopped) return;
      ctx = ctx ?? new AudioContext();
      void ctx.resume();
      const audio = await ctx.decodeAudioData(buffer.slice(0));
      if (stopped) return;
      const source = ctx.createBufferSource();
      source.buffer = audio;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.65;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(analyser);
      analyser.connect(gain);
      gain.connect(ctx.destination);
      const time = new Uint8Array(analyser.fftSize);
      const bins = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (stopped) return;
        analyser.getByteTimeDomainData(time);
        analyser.getByteFrequencyData(bins);
        let sum = 0;
        for (let i = 0; i < time.length; i += 1) {
          const v = (time[i]! - 128) / 128;
          sum += v * v;
        }
        const rms = Math.min(1, Math.sqrt(sum / time.length) * 4.6);
        if (into === "maja") setLevels(reduce ? 0.35 : rms, 0, bins);
        else setLevels(0, reduce ? 0.3 : rms, bins);
        frame = window.requestAnimationFrame(tick);
      };
      source.start();
      frame = window.requestAnimationFrame(tick);
      source.onended = () => window.cancelAnimationFrame(frame);
    };

    const start = () => {
      setLevels(0.18, 0, null);
      timers.push(window.setTimeout(() => {
        if (stopped) return;
        setScene("idle");
        setLevels(0.08, 0, null);
      }, 1600));
      timers.push(window.setTimeout(() => {
        if (stopped) return;
        setScene("maja");
        void play("/preview/speech-maja.wav", "maja");
      }, 2800));
      timers.push(window.setTimeout(() => {
        if (stopped) return;
        setScene("caller");
        void play("/preview/speech-caller.wav", "caller");
      }, 5300));
    };
    (window as Window & { startWaveDrive?: () => void }).startWaveDrive = start;

    return () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
      for (const id of timers) window.clearTimeout(id);
      void ctx?.close();
      previewLevels.current = SILENT_LEVELS;
      delete (window as Window & { startWaveDrive?: () => void }).startWaveDrive;
    };
  }, [drive]);

  let call: WebCallState = { phase: "idle" };
  if (scene === "ringing" || (scene === null && shot === "ringing")) call = { phase: "starting" };
  else if (scene === "idle" || scene === "maja" || scene === "caller" || shot === "live" || shot === "live-text") {
    call = { phase: "live", seconds: 42, maxSeconds: 240, lines: PREVIEW_LINES, outcome: "none" };
  } else if (shot === "live-booked") {
    call = { phase: "live", seconds: 64, maxSeconds: 240, lines: PREVIEW_LINES, bookingId, outcome: "booked" };
  } else if (shot === "ended") {
    call = { phase: "ended", record: mockRecord(undefined, "none"), saved: true };
  } else if (shot === "ended-booked" || shot === "ended-text") {
    call = { phase: "ended", record: mockRecord(bookingId, "booked"), saved: true };
  } else if (shot === "ended-handover") {
    call = { phase: "ended", record: mockRecord(undefined, "handover", PREVIEW_HANDOVER), saved: true };
  }

  return (
    <div data-shot={shot} className="flex min-h-0 flex-1 flex-col">
      <RingScreen
        key={shot}
        salon={salon}
        ownerName={ownerName}
        maxSeconds={240}
        state={state}
        call={call}
        muted={false}
        showText={showText}
        levels={previewLevels}
        instant
        speaker={speaker}
        wave={wave}
        portraitSrc={portraitSrc}
        onStart={() => undefined}
        onHangUp={() => undefined}
        onAgain={() => undefined}
        onMuted={() => undefined}
        onShowText={setShowText}
      />
    </div>
  );
}

export function RingPreview() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense>
        <RingPreviewBody />
      </Suspense>
    </div>
  );
}
