"use client";

import { useMemo } from "react";
import { ShieldCheck } from "lucide-react";
import type { DemoState, JournalAccess } from "@/concept/data/types";
import { t, tc } from "@/concept/i18n";
import { formatDate } from "@/concept/i18n/format";
import { RETENTION } from "@/concept/privacy/retention";
import { customersDueForReview, journalsPastRetention } from "@/concept/privacy/review";
import { fullName } from "@/concept/selectors";
import { entryTime } from "@/concept/studio/log/activity-list";
import { dispatchWithUndoToast } from "@/concept/studio/log/undo-toast";
import { MorePage } from "@/concept/studio/more/more-page";
import { useStudio } from "@/concept/studio/use-studio";
import { Avatar } from "@/concept/ui/avatar";
import { ButtonLink } from "@/concept/ui/button";
import { Card, Section } from "@/concept/ui/card";
import { Select } from "@/concept/ui/controls";
import { EmptyState } from "@/concept/ui/empty-state";
import { ListRow } from "@/concept/ui/list-row";
import { Notice } from "@/concept/ui/notice";

/** How many reads the page lists at once; the log itself keeps more. */
const SHOWN = 200;

function describeAccess(state: DemoState, access: JournalAccess): string {
  const staff = access.staffId ? state.staff.find((s) => s.id === access.staffId) : undefined;
  const who = access.actor === "owner" ? t("privacy.access.owner") : staff?.firstName ?? t("privacy.access.staff");
  if (!access.customerId) return t("privacy.access.all", { who });
  const customer = state.customers.find((c) => c.id === access.customerId);
  return customer ? t("privacy.access.opened", { who, customer: fullName(customer) }) : t("privacy.access.deleted", { who });
}

/** Privacy: who read journals, how long data is kept, and the customers due for review. Owner only. */
export default function PrivacyPage() {
  const { state, today } = useStudio();
  const due = useMemo(() => customersDueForReview(state, today), [state, today]);
  const journalDue = useMemo(() => journalsPastRetention(state, today), [state, today]);
  const years = state.privacy?.journalRetentionYears ?? null;
  const access = (state.journalAccess ?? []).slice(0, SHOWN);

  const setYears = (value: string) =>
    dispatchWithUndoToast({ type: "privacy/journal-retention", years: value === "" ? null : Number(value) }, t("privacy.journal.saved"));

  return (
    <MorePage title={t("privacy.title")} subtitle={t("privacy.subtitle")}>
      <div className="space-y-8 md:max-w-3xl">
        <Notice tone="warning">{t("privacy.confirm")}</Notice>

        <Section title={t("privacy.review.title")} action={<ButtonLink href="/studio/customers/review" helpId="privacy.review" variant="secondary" size="sm">{t("privacy.review.open")}</ButtonLink>}>
          <p className="text-body text-text-secondary">{t("privacy.review.text", { years: RETENTION.inactiveCustomerYears })}</p>
          <p className="text-body font-medium">{tc("review.subtitle", due.length, { years: RETENTION.inactiveCustomerYears })}</p>
        </Section>

        <Section title={t("privacy.journal.title")}>
          <p className="text-body text-text-secondary">{t("privacy.journal.text")}</p>
          <label className="block space-y-1">
            <span className="block text-body font-medium">{t("privacy.journal.label")}</span>
            <Select width="short" value={years === null ? "" : String(years)} onChange={(e) => setYears(e.target.value)}>
              <option value="">{t("privacy.journal.none")}</option>
              {RETENTION.journalYearsChoices.map((choice) => <option key={choice} value={choice}>{tc("privacy.journal.years", choice)}</option>)}
            </Select>
          </label>
          {journalDue.length > 0 && (
            <>
              <p className="text-body font-medium">{tc("privacy.journal.due", journalDue.length)}</p>
              <Card className="divide-y divide-hairline overflow-hidden">
                {journalDue.map(({ customer, entries, oldest }) => (
                  <ListRow key={customer.id} href={`/studio/customers/${customer.id}`}
                    leading={<Avatar name={fullName(customer)} />}
                    title={fullName(customer)}
                    meta={tc("privacy.journal.row", entries, { date: formatDate(oldest) })} />
                ))}
              </Card>
            </>
          )}
        </Section>

        <Section title={t("privacy.access.title")}>
          <p className="text-body text-text-secondary">{t("privacy.access.text", { months: RETENTION.journalAccessLogMonths })}</p>
          <p className="text-meta text-text-secondary">{t("privacy.access.limits")}</p>
          {access.length ? (
            <Card className="divide-y divide-hairline overflow-hidden">
              {access.map((row) => <ListRow key={row.id} title={describeAccess(state, row)} meta={entryTime(row.at, today)} />)}
            </Card>
          ) : (
            <EmptyState icon={<ShieldCheck size={22} />} title={t("privacy.access.empty")} />
          )}
        </Section>

        <Section title={t("privacy.rules.title")}>
          <ul className="list-disc space-y-2 pl-5 text-body text-text-secondary">
            <li>{t("privacy.rules.inactive", { years: RETENTION.inactiveCustomerYears })}</li>
            <li>{t("privacy.rules.journal")}</li>
            <li>{t("privacy.rules.activity", { months: RETENTION.activityPersonalDataMonths })}</li>
            <li>{t("privacy.rules.messages", { days: RETENTION.outboxBodyDays })}</li>
            <li>{t("privacy.rules.technical")}</li>
            <li>{t("privacy.rules.bookkeeping")}</li>
          </ul>
        </Section>
      </div>
    </MorePage>
  );
}
