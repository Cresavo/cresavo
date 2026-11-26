"use client";

import { useEffect, useMemo, useRef } from "react";
import { Mic, PhoneOff } from "lucide-react";
import type { DemoState } from "../../data/types";
import { t } from "../../i18n";
import { receptionistSettings } from "../../receptionist/actions";
import type { CallLimits } from "../../receptionist/limits";
import { Button, ButtonLink } from "../../ui/button";
import { Card, Section } from "../../ui/card";
import { FriendlyNotice, friendlyMessage } from "../../ui/friendly-message";
import { noticeHref } from "../notices/booking-notices";
import { clockText, Transcript } from "./transcript";
import { useTestCall, type TestCallFailure, type TestCallState } from "./use-test-call";

const WITH_WHY = new Set<TestCallFailure>(["connection", "daily-limit", "not-configured"]);

function problem(reason: TestCallFailure) {
  return friendlyMessage({ what: `receptionist.problem.${reason}.what`, why: WITH_WHY.has(reason) ? (`receptionist.problem.${reason}.why` as "receptionist.problem.connection.why") : undefined, next: `receptionist.problem.${reason}.next` });
}

function Ended({ call, onAgain }: { call: Extract<TestCallState, { phase: "ended" }>; onAgain: () => void }) {
  const { record, saved } = call;
  const cutShort = record.endedBy === "time-limit" || record.endedBy === "cost-limit" || record.endedBy === "error";
  return (
    <div className="space-y-4">
      <p role="status" className="text-body">
        {t(`receptionist.test.ended.${record.outcome}`)}
        {cutShort && <> {t(`receptionist.test.endedBy.${record.endedBy as "error"}`)}</>}
      </p>
      {!saved && <FriendlyNotice message={friendlyMessage({ what: "receptionist.test.notSaved.what", next: "receptionist.test.notSaved.next" })} />}
      <div className="flex flex-wrap gap-2">
        {record.bookingId && record.outcome !== "cancelled" && <ButtonLink href={noticeHref(record.bookingId)} width="responsive">{t("receptionist.calls.openBooking")}</ButtonLink>}
        <Button variant="secondary" width="responsive" icon={<Mic size={18} aria-hidden />} onClick={onAgain}>{t("receptionist.test.again")}</Button>
      </div>
    </div>
  );
}

/** "Try in the browser": a call with Maja through this device's microphone, with the same engine a phone call would use. */
export function TestCallSection({ state, limits, configured }: { state: DemoState; limits: CallLimits; configured: boolean }) {
  const speaker = useRef<HTMLAudioElement>(null);
  const settings = receptionistSettings(state);
  const { name } = state.salon;
  const { language } = state.localization;
  const salon = useMemo(() => ({ salonName: name, language, greeting: settings.greeting }), [name, language, settings.greeting]);
  const { state: call, start, hangUp, reset } = useTestCall(salon, speaker);
  // Switching Maja off ends a call that is connecting or in progress: the switch means she stops answering now.
  const active = call.phase === "starting" || call.phase === "live";
  useEffect(() => {
    if (!settings.enabled && active) hangUp();
  }, [settings.enabled, active, hangUp]);
  const startButton = <Button width="responsive" icon={<Mic size={18} aria-hidden />} onClick={() => void start()}>{t("receptionist.test.start")}</Button>;

  return (
    <Section title={t("receptionist.test.title")}>
      <Card className="space-y-4 p-4">
        <audio ref={speaker} autoPlay hidden />
        {(call.phase === "idle" || call.phase === "failed") && (
          <>
            <p className="text-body text-text-secondary">{t("receptionist.test.text")} {t("receptionist.test.limit", { minutes: Math.round(limits.maxSeconds / 60) })}</p>
            {call.phase === "failed" && <FriendlyNotice message={problem(call.reason)} />}
            {!configured && call.phase === "idle" && <FriendlyNotice message={problem("not-configured")} />}
            {settings.enabled ? configured && startButton : <p className="text-body">{t("receptionist.test.switchOn")}</p>}
          </>
        )}
        {call.phase === "starting" && (
          <>
            <p role="status" className="text-body">{t("receptionist.test.starting")}</p>
            <Button variant="secondary" width="responsive" icon={<PhoneOff size={18} aria-hidden />} onClick={hangUp}>{t("receptionist.test.hangUp")}</Button>
          </>
        )}
        {call.phase === "live" && (
          <>
            <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-body">
              <span className="font-medium">{t("receptionist.test.live")}</span>
              <span className="tabular-nums text-text-secondary">{t("receptionist.test.clock", { elapsed: clockText(call.seconds), limit: clockText(call.maxSeconds) })}</span>
            </p>
            {call.lines.length === 0 ? <p className="text-body text-text-secondary">{t("receptionist.test.waiting")}</p> : <Transcript lines={call.lines} live />}
            <Button variant="secondary" width="responsive" icon={<PhoneOff size={18} aria-hidden />} onClick={hangUp}>{t("receptionist.test.hangUp")}</Button>
          </>
        )}
        {call.phase === "ended" && <Ended call={call} onAgain={reset} />}
      </Card>
    </Section>
  );
}
