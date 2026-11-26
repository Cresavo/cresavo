"use client";

import type { RefObject } from "react";
import "./ring-screen.css";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import type { DemoState } from "../../data/types";
import { t } from "../../i18n";
import type { MessageKey } from "../../i18n";
import type { WebCallFailure } from "../../receptionist/web-call/browser";
import type { WebCallSalon } from "../../receptionist/web-call/persona";
import type { CallOutcome, TranscriptLine } from "../../receptionist/types";
import { Button, ButtonLink } from "../../ui/button";
import { cx } from "../../ui/cx";
import { FriendlyNotice, friendlyMessage } from "../../ui/friendly-message";
import { noticeHref } from "../notices/booking-notices";
import { BookingResult, HandoverResult } from "./booking-result";
import { callClock } from "./call-levels";
import { CallVisualizer } from "./call-visualizer";
import type { CallLevels } from "./use-call-audio";
import type { WebCallState } from "./use-web-call";

// The public call window with Maja: a calm, shareable phone-like screen.
// Inspired by Fable's voice-first layout (named agent at the centre, the
// transcript off until you ask for it, a clear end-of-call card) but drawn
// with Cresavo tokens only.

export type RingPhase = WebCallState["phase"];

function problem(reason: WebCallFailure, retryAfter?: number) {
  const minutes = Math.max(1, Math.ceil((retryAfter ?? 60) / 60));
  return friendlyMessage({ what: `webCall.problem.${reason}.what` as MessageKey, next: `webCall.problem.${reason}.next` as MessageKey }, { minutes });
}

function statusText(call: WebCallState) {
  if (call.phase === "starting") return t("webCall.status.ringing");
  if (call.phase === "live") return t("webCall.status.live", { elapsed: callClock(call.seconds) });
  if (call.phase === "ended") return t("webCall.status.ended");
  return null;
}

function Transcript({ lines }: { lines: readonly TranscriptLine[] }) {
  const recent = lines.slice(-8);
  return (
    <ol aria-live="polite" className="w-full space-y-3 text-left text-body">
      {recent.map((line, index) => (
        <li key={`${line.at}-${index}`} className={line.who === "caller" ? "text-text-secondary" : "text-text"}>
          <span className="font-medium">{line.who === "caller" ? t("webCall.you") : t("webCall.maja")}: </span>
          {line.text}
        </li>
      ))}
    </ol>
  );
}

function MajaMark({ ringing }: { ringing: boolean }) {
  return (
    <div
      className={cx(
        "flex size-24 items-center justify-center rounded-full bg-action-bg text-h1 font-medium text-action",
        ringing && "maja-ring",
      )}
      aria-hidden
    >
      {t("webCall.monogram")}
    </div>
  );
}

export function RingScreen({
  salon,
  ownerName,
  maxSeconds,
  state,
  call,
  muted,
  showText,
  levels,
  instant,
  speaker,
  onStart,
  onHangUp,
  onAgain,
  onMuted,
  onShowText,
}: {
  salon: WebCallSalon;
  ownerName: string;
  maxSeconds: number;
  state: DemoState;
  call: WebCallState;
  muted: boolean;
  showText: boolean;
  levels: CallLevels;
  instant?: boolean;
  speaker: RefObject<HTMLAudioElement | null>;
  onStart: () => void;
  onHangUp: () => void;
  onAgain: () => void;
  onMuted: (muted: boolean) => void;
  onShowText: (show: boolean) => void;
}) {
  const status = statusText(call);
  const ringing = call.phase === "starting";
  const live = call.phase === "live";
  const ended = call.phase === "ended";
  const waveActive = live || ringing;
  const lines = live ? call.lines : ended ? call.record.transcript : [];
  const bookingId = live ? call.bookingId : ended ? call.record.bookingId : undefined;
  const outcome: CallOutcome = live ? call.outcome : ended ? call.record.outcome : "none";
  const booking = bookingId ? state.bookings.find((item) => item.id === bookingId) : undefined;
  const showBooking = booking && (outcome === "booked" || outcome === "moved" || outcome === "cancelled");
  const handover = (live ? call.handoverReason : ended ? call.record.handoverReason : undefined) ?? "";
  const canRetry = !(call.phase === "failed" && (call.reason === "closed" || call.reason === "daily-limit"));

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col px-4 sm:max-w-lg">
      <audio ref={speaker} autoPlay playsInline hidden />

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-4 text-center">
        <div className="mt-auto" aria-hidden />
        <div className="flex flex-col items-center gap-5">
        <MajaMark ringing={ringing} />
        <div className="space-y-1">
          <h1 className="text-h2 font-medium">{t("webCall.maja")}</h1>
          <p className="text-body text-text-secondary">{t("webCall.role", { salon: salon.salonName })}</p>
        </div>
        {waveActive && (
        <CallVisualizer
          majaLevel={live ? levels.maja : ringing ? 0.22 : 0}
          callerLevel={live && !muted ? levels.caller : 0}
          bins={live ? levels.bins : null}
          active={waveActive}
        />
        )}
        {status && (
          <p role="status" className="text-body tabular-nums" aria-label={live ? t("webCall.clockLabel", { elapsed: callClock(call.seconds), limit: callClock(call.maxSeconds) }) : undefined}>
            {status}
          </p>
        )}
        {(call.phase === "idle" || call.phase === "failed") && (
          <p className="max-w-reading text-body text-text-secondary">{t("webCall.intro", { minutes: Math.round(maxSeconds / 60) })}</p>
        )}
        {call.phase === "failed" && <FriendlyNotice message={problem(call.reason, call.retryAfter)} />}
        {ringing && <p className="text-body text-text-secondary">{t("webCall.starting")}</p>}
        {live && lines.length === 0 && !showText && (
          <p className="text-body text-text-secondary">{t("webCall.listening")}</p>
        )}
        {showBooking && (
          <BookingResult
            state={state}
            booking={booking}
            outcome={outcome}
            instant={instant}
          />
        )}
        {outcome === "handover" && <HandoverResult reason={handover} instant={instant} />}
        {showText && lines.length > 0 && <Transcript lines={lines} />}
        {ended && !showBooking && outcome !== "handover" && (
          <p className="text-body">{t(`webCall.ended.${call.record.outcome}` as MessageKey)}</p>
        )}
        {ended && (call.record.endedBy === "time-limit" || call.record.endedBy === "cost-limit" || call.record.endedBy === "error") && (
          <p className="text-body text-text-secondary">{t(`webCall.endedBy.${call.record.endedBy}` as MessageKey)}</p>
        )}
        {ended && !call.saved && <FriendlyNotice message={friendlyMessage({ what: "webCall.notSaved.what", next: "webCall.notSaved.next" })} />}
        </div>
        <div className="mb-auto" aria-hidden />
      </div>

      <div className="flex shrink-0 flex-col items-center gap-4 py-4">
        {(call.phase === "idle" || call.phase === "failed") && canRetry && (
          <Button size="lg" className="rounded-full px-12" icon={<Phone size={20} aria-hidden />} onClick={onStart}>
            {call.phase === "failed" ? t("webCall.tryAgain") : t("webCall.start", { salon: salon.salonName })}
          </Button>
        )}
        {ringing && (
          <Button variant="danger" className="maja-round size-16 px-0" icon={<PhoneOff size={24} aria-hidden />} aria-label={t("webCall.cancel")} onClick={onHangUp}>
            <span className="sr-only">{t("webCall.cancel")}</span>
          </Button>
        )}
        {live && (
          <div className="flex items-center gap-6">
            <Button
              variant="secondary"
              className="maja-round size-14 px-0"
              icon={muted ? <MicOff size={22} aria-hidden /> : <Mic size={22} aria-hidden />}
              aria-pressed={muted}
              aria-label={muted ? t("webCall.unmute") : t("webCall.mute")}
              onClick={() => onMuted(!muted)}
            >
              <span className="sr-only">{muted ? t("webCall.unmute") : t("webCall.mute")}</span>
            </Button>
            <Button
              variant="danger"
              className="maja-round size-16 px-0"
              icon={<PhoneOff size={24} aria-hidden />}
              aria-label={t("webCall.hangUp")}
              onClick={onHangUp}
            >
              <span className="sr-only">{t("webCall.hangUp")}</span>
            </Button>
          </div>
        )}
        {ended && (
          <div className="flex w-full flex-col items-center gap-2 sm:flex-row sm:justify-center">
            {call.record.bookingId && call.record.outcome !== "cancelled" && (
              <ButtonLink href={noticeHref(call.record.bookingId)} width="responsive">{t("webCall.openBooking")}</ButtonLink>
            )}
            <Button variant="secondary" width="responsive" icon={<Phone size={18} aria-hidden />} onClick={onAgain}>{t("webCall.again")}</Button>
          </div>
        )}
        {(live || ended) && (
          <Button variant="link" onClick={() => onShowText(!showText)}>
            {showText ? t("webCall.hideText") : t("webCall.showText")}
          </Button>
        )}
        {(call.phase === "idle" || call.phase === "failed") && (
          <p className="text-meta text-text-secondary">{t("webCall.subtitle", { owner: ownerName || t("webCall.ownerFallback") })}</p>
        )}
      </div>
    </div>
  );
}

