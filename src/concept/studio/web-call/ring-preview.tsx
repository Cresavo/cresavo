"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { CallRecord } from "../../receptionist/types";
import { PREVIEW_HANDOVER, PREVIEW_LINES } from "./ring-preview-lines";
import { useStudio } from "../use-studio";
import { ownerOf } from "./ring-page";
import { RingScreen } from "./ring-screen";
import type { WebCallState } from "./use-web-call";

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
  const shot = params.get("shot") ?? "idle";
  const { state } = useStudio();
  const speaker = useRef<HTMLAudioElement>(null);
  const salonName = state.salon.name;
  const ownerName = ownerOf(state);
  const salon = useMemo(() => ({ salonName, language: "sv" as const, ownerName }), [salonName, ownerName]);
  const booked = state.bookings.find((item) => item.status === "booked") ?? state.bookings[0];
  const bookingId = booked?.id;
  const textDefault = shot === "live-text" || shot === "ended-text";
  const [showText, setShowText] = useState(textDefault);

  let call: WebCallState = { phase: "idle" };
  if (shot === "ringing") call = { phase: "starting" };
  else if (shot === "live" || shot === "live-text") {
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
        levels={{ maja: shot.startsWith("live") ? 0.55 : shot === "ringing" ? 0.2 : 0, caller: shot.startsWith("live") ? 0.25 : 0, bins: null }}
        instant
        speaker={speaker}
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
