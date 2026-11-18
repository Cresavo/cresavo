"use client";

import { LifeBuoy } from "lucide-react";
import { toKey, formatTime } from "../../data/dates";
import { t, tc } from "../../i18n";
import { relativeDay } from "../../i18n/format";
import { Badge } from "../../ui/badge";
import { Card } from "../../ui/card";
import { EmptyState } from "../../ui/empty-state";
import { useStudio } from "../use-studio";

/** The demo's one place for help requests created from the Help button. */
export function TicketsList() {
  const { state, today } = useStudio();
  if (!state.tickets.length) return <EmptyState icon={<LifeBuoy size={22} />} title={t("tickets.empty")} text={t("tickets.emptyText")} />;
  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondary">{t("tickets.intro")}</p>
      <Card>
        <ul className="divide-y divide-hairline">
          {state.tickets.map((ticket) => {
            const date = new Date(ticket.createdAt);
            return (
              <li key={ticket.id} className="space-y-2 px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-[15px] font-medium leading-snug">{ticket.question}</p>
                  <Badge tone="accent">{t("tickets.open")}</Badge>
                </div>
                <p className="text-xs text-text-secondary">
                  {relativeDay(toKey(date), today)} {formatTime(date.getHours() * 60 + date.getMinutes())} · {ticket.path} · {t("tickets.request", { id: ticket.requestId.slice(0, 8) })}
                </p>
                <details className="text-sm">
                  <summary className="cursor-pointer text-text-secondary hover:text-text">
                    {t("tickets.attached", { screen: tc("ticket.lines", ticket.screen.length), activity: tc("ticket.changes", ticket.activity.length) })}
                  </summary>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <ul className="space-y-0.5 text-xs text-text-secondary">
                      {ticket.screen.map((line) => <li key={line}>{line}</li>)}
                    </ul>
                    <ul className="space-y-0.5 text-xs text-text-secondary">
                      {ticket.activity.map((a) => <li key={`${a.at}-${a.summary}`}>{a.summary}</li>)}
                    </ul>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
