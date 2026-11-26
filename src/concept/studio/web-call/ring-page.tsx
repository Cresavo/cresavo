"use client";

import { useMemo, useRef, useState } from "react";
import type { DemoState } from "../../data/types";
import { t } from "../../i18n";
import type { WebCallSalon } from "../../receptionist/web-call/persona";
import type { WebCallStatus } from "../../receptionist/web-call/runtime";
import { useActiveWorkspace } from "../../store";
import { ButtonLink } from "../../ui/button";
import { FriendlyNotice, friendlyMessage } from "../../ui/friendly-message";
import { useStudio } from "../use-studio";
import { RingScreen } from "./ring-screen";
import { useCallAudio } from "./use-call-audio";
import { useWebCall } from "./use-web-call";

// "Ring Maja": the public demo's call with the sample salon's AI receptionist.
// The screen is a calm, shareable call window: her name, a live wave, mute and
// hang up, the transcript hidden until asked for, and a booking card when a
// time is booked.

/** The salon's owner: the person with the owner role, else the first on the team. */
export function ownerOf(state: DemoState): string {
  const owner = state.staff.find((person) => /^(owner|ägare)$/i.test(person.role.trim())) ?? state.staff[0];
  return owner?.firstName ?? "";
}

function Closed({ status }: { status: WebCallStatus }) {
  const key = status.reason === "off" ? "closed" : "not-configured";
  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      <FriendlyNotice
        message={friendlyMessage({ what: `webCall.problem.${key}.what` as const, next: `webCall.problem.${key}.next` as const })}
        action={<ButtonLink href="/boka/salong-eko" variant="secondary">{t("webCall.bookOnline")}</ButtonLink>}
      />
    </div>
  );
}

function CallPanel({ token, salon, ownerName, maxSeconds, state }: { token: string; salon: WebCallSalon; ownerName: string; maxSeconds: number; state: DemoState }) {
  const speaker = useRef<HTMLAudioElement>(null);
  const { state: call, start, hangUp, reset, muted, setMuted, microphone } = useWebCall(token, salon, speaker);
  const [showText, setShowText] = useState(false);
  const levels = useCallAudio({
    speaker,
    microphone,
    ringing: call.phase === "starting",
    muted,
  });
  return (
    <RingScreen
      salon={salon}
      ownerName={ownerName}
      maxSeconds={maxSeconds}
      state={state}
      call={call}
      muted={muted}
      showText={showText}
      levels={levels}
      speaker={speaker}
      onStart={() => void start()}
      onHangUp={hangUp}
      onAgain={reset}
      onMuted={setMuted}
      onShowText={setShowText}
    />
  );
}

/** The page. `token` is the signed page token the server rendered it with. */
export function RingPage({ token, status }: { token: string | null; status: WebCallStatus }) {
  const { state } = useStudio();
  const workspace = useActiveWorkspace();
  const salonName = state.salon.name;
  const ownerName = ownerOf(state);
  // Maja answers in Swedish, like the salon; she switches to English when the caller speaks English.
  const salon = useMemo<WebCallSalon>(() => ({ salonName, language: "sv", ownerName }), [salonName, ownerName]);
  if (workspace !== "demo") {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-8">
        <FriendlyNotice message={friendlyMessage({ what: "webCall.problem.own.what", next: "webCall.problem.own.next" })} />
      </div>
    );
  }
  if (!status.available || !token) return <Closed status={status} />;
  return <CallPanel token={token} salon={salon} ownerName={ownerName} maxSeconds={status.maxSeconds} state={state} />;
}
