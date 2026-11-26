"use client";

import { useMemo, useRef } from "react";
import { Phone, PhoneOff } from "lucide-react";
import type { DemoState } from "../../data/types";
import { t } from "../../i18n";
import type { MessageKey } from "../../i18n";
import type { WebCallFailure } from "../../receptionist/web-call/browser";
import type { WebCallSalon } from "../../receptionist/web-call/persona";
import type { WebCallStatus } from "../../receptionist/web-call/runtime";
import type { TranscriptLine } from "../../receptionist/types";
import { useActiveWorkspace } from "../../store";
import { Button, ButtonLink } from "../../ui/button";
import { Card } from "../../ui/card";
import { FriendlyNotice, friendlyMessage } from "../../ui/friendly-message";
import { noticeHref } from "../notices/booking-notices";
import { PageHeader } from "../page-header";
import { useStudio } from "../use-studio";
import { useWebCall, type WebCallState } from "./use-web-call";

// "Ring Maja": the public demo's one-button call with the sample salon's AI
// receptionist. Calm and phone-first: one big button, a clear way to hang up,
// what was said, and a friendly next step whenever something is in the way.

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** The salon's owner: the person with the owner role, else the first on the team. */
function ownerOf(state: DemoState): string {
  const owner = state.staff.find((person) => /^(owner|ägare)$/i.test(person.role.trim())) ?? state.staff[0];
  return owner?.firstName ?? "";
}

function problem(reason: WebCallFailure, retryAfter?: number) {
  const minutes = Math.max(1, Math.ceil((retryAfter ?? 60) / 60));
  return friendlyMessage({ what: `webCall.problem.${reason}.what` as MessageKey, next: `webCall.problem.${reason}.next` as MessageKey }, { minutes });
}

function Transcript({ lines }: { lines: readonly TranscriptLine[] }) {
  const recent = lines.slice(-6);
  return (
    <ol aria-live="polite" className="space-y-2 text-body">
      {recent.map((line, index) => (
        <li key={`${line.at}-${index}`} className={line.who === "caller" ? "text-text-secondary" : "text-text"}>
          <span className="font-medium">{line.who === "caller" ? t("webCall.you") : t("webCall.maja")}: </span>
          {line.text}
        </li>
      ))}
    </ol>
  );
}

function Ended({ call, onAgain }: { call: Extract<WebCallState, { phase: "ended" }>; onAgain: () => void }) {
  const { record, saved } = call;
  const cutShort = record.endedBy === "time-limit" || record.endedBy === "cost-limit" || record.endedBy === "error";
  return (
    <div className="space-y-4">
      <p role="status" className="text-body">
        {t(`webCall.ended.${record.outcome}` as MessageKey)}
        {cutShort && <> {t(`webCall.endedBy.${record.endedBy}` as MessageKey)}</>}
      </p>
      {!saved && <FriendlyNotice message={friendlyMessage({ what: "webCall.notSaved.what", next: "webCall.notSaved.next" })} />}
      <div className="flex flex-col gap-2 sm:flex-row">
        {record.bookingId && record.outcome !== "cancelled" && <ButtonLink href={noticeHref(record.bookingId)} width="responsive">{t("webCall.openBooking")}</ButtonLink>}
        <Button variant="secondary" width="responsive" icon={<Phone size={18} aria-hidden />} onClick={onAgain}>{t("webCall.again")}</Button>
      </div>
    </div>
  );
}

function Closed({ status }: { status: WebCallStatus }) {
  const key = status.reason === "off" ? "closed" : "not-configured";
  return (
    <FriendlyNotice
      message={friendlyMessage({ what: `webCall.problem.${key}.what` as MessageKey, next: `webCall.problem.${key}.next` as MessageKey })}
      action={<ButtonLink href="/boka/salong-eko" variant="secondary">{t("webCall.bookOnline")}</ButtonLink>}
    />
  );
}

function CallPanel({ token, salon, maxSeconds }: { token: string; salon: WebCallSalon; maxSeconds: number }) {
  const speaker = useRef<HTMLAudioElement>(null);
  const { state: call, start, hangUp, reset } = useWebCall(token, salon, speaker);
  return (
    <Card className="space-y-5 p-5">
      {/* playsInline keeps iPhone Safari from opening a player; the element only carries her voice. */}
      <audio ref={speaker} autoPlay playsInline hidden />
      {(call.phase === "idle" || call.phase === "failed") && (
        <>
          <p className="text-body text-text-secondary">{t("webCall.intro", { minutes: Math.round(maxSeconds / 60) })}</p>
          {call.phase === "failed" && <FriendlyNotice message={problem(call.reason, call.retryAfter)} />}
          {!(call.phase === "failed" && (call.reason === "closed" || call.reason === "daily-limit")) && (
            <Button size="lg" width="responsive" icon={<Phone size={20} aria-hidden />} onClick={() => void start()}>
              {call.phase === "failed" ? t("webCall.tryAgain") : t("webCall.start", { salon: salon.salonName })}
            </Button>
          )}
        </>
      )}
      {call.phase === "starting" && (
        <>
          <p role="status" className="text-body">{t("webCall.starting")}</p>
          <Button size="lg" variant="secondary" width="responsive" icon={<PhoneOff size={20} aria-hidden />} onClick={hangUp}>{t("webCall.cancel")}</Button>
        </>
      )}
      {call.phase === "live" && (
        <>
          <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-body">
            <span className="font-medium">{t("webCall.live")}</span>
            <span className="tabular-nums text-text-secondary" aria-label={t("webCall.clockLabel", { elapsed: clock(call.seconds), limit: clock(call.maxSeconds) })}>
              {clock(call.seconds)} / {clock(call.maxSeconds)}
            </span>
          </p>
          {call.lines.length === 0 ? <p className="text-body text-text-secondary">{t("webCall.listening")}</p> : <Transcript lines={call.lines} />}
          <Button size="lg" variant="danger" width="responsive" icon={<PhoneOff size={20} aria-hidden />} onClick={hangUp}>{t("webCall.hangUp")}</Button>
        </>
      )}
      {call.phase === "ended" && <Ended call={call} onAgain={reset} />}
    </Card>
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
  return (
    <div className="mx-auto w-full max-w-form space-y-6">
      <PageHeader title={t("webCall.title", { salon: salonName })} subtitle={t("webCall.subtitle", { owner: ownerName || t("webCall.ownerFallback") })} tools={false} />
      {workspace !== "demo" ? (
        <FriendlyNotice message={friendlyMessage({ what: "webCall.problem.own.what", next: "webCall.problem.own.next" })} />
      ) : !status.available || !token ? (
        <Closed status={status} />
      ) : (
        <CallPanel token={token} salon={salon} maxSeconds={status.maxSeconds} />
      )}
    </div>
  );
}
