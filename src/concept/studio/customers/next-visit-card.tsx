"use client";

import { CalendarClock, Check, Send } from "lucide-react";
import { suggestionSent, type NextVisit } from "../../customers/return-visits";
import { diffDays, formatTime } from "../../data/dates";
import type { Customer } from "../../data/types";
import { t } from "../../i18n";
import { formatDate, relativeDay } from "../../i18n/format";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { useStudio } from "../use-studio";
import { suggestedTime } from "../../customers/time-suggestion";
import { sendTimeSuggestion } from "./send-suggestion";

/** The booked visit, or the date the customer is due back with a one-tap time suggestion. */
export function NextVisitCard({ customer, next, lastVisit }: { customer: Customer; next?: NextVisit; lastVisit?: string }) {
  const { state, today, minutes } = useStudio();
  if (!next) {
    return (
      <Card className="flex items-start gap-3 p-4">
        <CalendarClock size={20} className="mt-0.5 shrink-0 text-eko-muted" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-eko-muted">{t("customer.next.title")}</p>
          <p className="mt-0.5 text-sm">{t("customer.next.none")}</p>
        </div>
      </Card>
    );
  }
  const due = !next.booking && diffDays(today, next.date) >= 0;
  const sent = !!lastVisit && suggestionSent(state, customer.id, lastVisit);
  const time = !next.booking ? suggestedTime(state, customer, next.service, today) : undefined;
  const headline = next.booking
    ? t("customer.next.booked", { when: `${relativeDay(next.booking.date, today)} ${formatTime(next.booking.start)}` })
    : due
      ? t("customer.next.due", { date: formatDate(next.date) })
      : t("customer.next.suggested", { date: formatDate(next.date) });

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start gap-3">
        <CalendarClock size={20} className="mt-0.5 shrink-0 text-eko-accent" />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-eko-muted">{t("customer.next.title")}</p>
          <p className="mt-0.5 font-semibold">{headline}</p>
          <p className="text-sm text-eko-muted">{t("customer.next.interval", { service: next.service.name, weeks: next.weeks })}</p>
          {due && time && <p className="mt-1 text-sm">{t("dueBack.suggests", time)}</p>}
        </div>
      </div>
      {due && (
        <Button
          size="sm"
          className="w-full"
          variant={sent ? "secondary" : "primary"}
          disabled={sent}
          icon={sent ? <Check size={16} /> : <Send size={16} />}
          onClick={() => sendTimeSuggestion(state, customer, next.service, today, minutes)}
        >
          {sent ? t("customer.next.sent") : t("customer.next.send")}
        </Button>
      )}
    </Card>
  );
}
