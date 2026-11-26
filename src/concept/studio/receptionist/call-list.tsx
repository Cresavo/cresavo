import { ChevronRight, Phone } from "lucide-react";
import type { DemoState } from "../../data/types";
import { t } from "../../i18n";
import { formatDayShort, formatTime, formatUsd } from "../../i18n/format";
import { MAX_CALLS, type CallRecord } from "../../receptionist/types";
import { findService } from "../../selectors";
import { ButtonLink } from "../../ui/button";
import { Card, Section } from "../../ui/card";
import { EmptyState } from "../../ui/empty-state";
import { noticeHref } from "../notices/booking-notices";
import { Transcript } from "./transcript";

function bookingLine(state: DemoState, call: CallRecord): string | undefined {
  if (!call.bookingId) return undefined;
  const booking = state.bookings.find((b) => b.id === call.bookingId);
  if (!booking) return t("receptionist.calls.bookingGone");
  return t("receptionist.calls.booking", {
    service: findService(state, booking.serviceId)?.name ?? "",
    day: formatDayShort(booking.date),
    time: formatTime(booking.start),
    staff: state.staff.find((s) => s.id === booking.staffId)?.firstName ?? "",
  });
}

function Call({ state, call }: { state: DemoState; call: CallRecord }) {
  const booking = bookingLine(state, call);
  const inCalendar = call.outcome !== "cancelled" && state.bookings.some((b) => b.id === call.bookingId);
  const duration = t("receptionist.calls.duration", { minutes: Math.floor(call.durationSec / 60), seconds: call.durationSec % 60 });
  return (
    <details className="group">
      <summary className="ui-row flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-md px-4 py-2 hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1 break-words">
          <span className="block text-body font-medium">{formatDayShort(call.date)} {formatTime(call.time)} · {t(`receptionist.calls.outcome.${call.outcome}`)}</span>
          <span className="block text-meta text-text-secondary">{booking ?? t(`receptionist.calls.channel.${call.channel}`)} · {duration}</span>
        </span>
        <ChevronRight size={18} aria-hidden className="shrink-0 text-text-secondary transition-transform duration-normal group-open:rotate-90 motion-reduce:transition-none" />
      </summary>
      <div className="space-y-4 px-4 pb-4 pt-1">
        {call.handoverReason && <p className="text-body">{t("receptionist.calls.note", { reason: call.handoverReason })}</p>}
        {call.transcript.length > 0 ? <Transcript lines={call.transcript} /> : <p className="text-body text-text-secondary">{t("receptionist.calls.noTranscript")}</p>}
        <p className="text-meta text-text-secondary">{t(`receptionist.calls.channel.${call.channel}`)} · {t("receptionist.calls.cost", { amount: formatUsd(call.costUsd) })}</p>
        {inCalendar && <ButtonLink href={noticeHref(call.bookingId!)} variant="secondary" size="sm">{t("receptionist.calls.openBooking")}</ButtonLink>}
      </div>
    </details>
  );
}

/** The calls Maja took, newest first: when, what came of it and which booking, with the transcript one tap away. */
export function CallList({ state }: { state: DemoState }) {
  const calls = state.receptionistCalls ?? [];
  return (
    <Section title={t("receptionist.calls.title")}>
      {calls.length === 0 ? (
        <EmptyState icon={<Phone size={22} />} title={t("receptionist.calls.empty.title")} text={t("receptionist.calls.empty.text")} />
      ) : (
        <>
          <Card className="overflow-hidden py-1">
            <ul className="divide-y divide-hairline">
              {calls.map((call) => <li key={call.id}><Call state={state} call={call} /></li>)}
            </ul>
          </Card>
          <p className="text-meta text-text-secondary">{t("receptionist.calls.kept", { count: MAX_CALLS })}</p>
        </>
      )}
    </Section>
  );
}
