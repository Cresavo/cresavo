"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Check, Minus, Plus, Send, UserRoundCheck } from "lucide-react";
import { dueBackList, MAX_INTERVAL_WEEKS, MIN_INTERVAL_WEEKS } from "@/concept/customers/return-visits";
import { t, tc } from "@/concept/i18n";
import { formatDate } from "@/concept/i18n/format";
import { buildCustomerStats, fullName } from "@/concept/selectors";
import { dispatch } from "@/concept/store";
import { BackLink } from "@/concept/studio/back-link";
import { sendTimeSuggestion, suggestedTime } from "@/concept/studio/customers/send-suggestion";
import { PageHeader } from "@/concept/studio/page-header";
import { useStudio } from "@/concept/studio/use-studio";
import { Avatar } from "@/concept/ui/avatar";
import { Badge } from "@/concept/ui/badge";
import { IconButton } from "@/concept/ui/button";
import { Card, Section } from "@/concept/ui/card";
import { EmptyState } from "@/concept/ui/empty-state";

export default function DueBackPage() {
  const { state, today, minutes } = useStudio();
  const stats = useMemo(() => buildCustomerStats(state, today), [state, today]);
  const due = useMemo(() => dueBackList(state, stats, today), [state, stats, today]);

  return (
    <>
      <PageHeader
        title={t("dueBack.title")}
        subtitle={tc("dueBack.subtitle", due.length)}
        back={<BackLink href="/studio/customers" label={t("dueBack.back")} />}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          {due.length ? (
            <Card className="divide-y divide-eko-line overflow-hidden">
              {due.map((row) => {
                const time = suggestedTime(state, row.customer, row.service, today);
                return (
                  <div key={row.customer.id} className="flex items-center gap-2 px-4 py-3">
                    <Link href={`/studio/customers/${row.customer.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar name={fullName(row.customer)} />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="truncate font-medium">{fullName(row.customer)}</span>
                          <Badge tone={row.overdueDays ? "warn" : "accent"}>
                            {row.overdueDays ? tc("dueBack.overdue", row.overdueDays) : t("dueBack.dueToday")}
                          </Badge>
                        </span>
                        <span className="block text-sm text-eko-muted">{t("dueBack.due", { service: row.service.name, date: formatDate(row.dueDate) })}</span>
                        <span className="block text-sm text-eko-muted">{time ? t("dueBack.suggests", time) : t("dueBack.noSlot")}</span>
                      </span>
                    </Link>
                    <IconButton
                      label={row.sent ? t("dueBack.sent") : t("dueBack.send", { name: row.customer.firstName })}
                      className="shrink-0"
                      disabled={row.sent}
                      onClick={() => sendTimeSuggestion(state, row.customer, row.service, today, minutes)}
                    >
                      {row.sent ? <Check size={18} /> : <Send size={18} />}
                    </IconButton>
                  </div>
                );
              })}
            </Card>
          ) : (
            <EmptyState icon={<UserRoundCheck size={22} />} title={t("dueBack.empty")} text={t("dueBack.emptyText")} />
          )}
        </div>
        <Section title={t("dueBack.intervals")} className="min-w-0 self-start">
          <Card className="divide-y divide-eko-line overflow-hidden">
            <p className="px-4 py-3 text-sm text-eko-muted">{t("dueBack.intervalsHint")}</p>
            {state.services.map((service) => (
              <div key={service.id} className="flex items-center gap-2 px-4 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm">{service.name}</span>
                <IconButton
                  label={t("dueBack.shorter", { service: service.name })}
                  disabled={service.recallWeeks <= MIN_INTERVAL_WEEKS}
                  onClick={() => dispatch({ type: "service/recall", id: service.id, weeks: service.recallWeeks - 1 })}
                >
                  <Minus size={16} />
                </IconButton>
                <span className="w-16 text-center text-sm font-semibold tabular-nums">{tc("dueBack.weeks", service.recallWeeks)}</span>
                <IconButton
                  label={t("dueBack.longer", { service: service.name })}
                  disabled={service.recallWeeks >= MAX_INTERVAL_WEEKS}
                  onClick={() => dispatch({ type: "service/recall", id: service.id, weeks: service.recallWeeks + 1 })}
                >
                  <Plus size={16} />
                </IconButton>
              </div>
            ))}
          </Card>
        </Section>
      </div>
    </>
  );
}
