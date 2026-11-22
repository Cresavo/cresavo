"use client";

import { useMemo, useState } from "react";
import { Check, Eraser, Trash2, UserRoundCheck } from "lucide-react";
import type { Customer } from "@/concept/data/types";
import { t, tc } from "@/concept/i18n";
import { formatDate } from "@/concept/i18n/format";
import { RETENTION } from "@/concept/privacy/retention";
import { customersDueForReview } from "@/concept/privacy/review";
import { fullName } from "@/concept/selectors";
import { TRASH_DAYS } from "@/concept/trash/trash";
import { BackLink } from "@/concept/studio/back-link";
import { EraseCustomerSheet } from "@/concept/studio/customers/erase-customer";
import { dispatchWithUndoToast } from "@/concept/studio/log/undo-toast";
import { PageHeader } from "@/concept/studio/page-header";
import { useStudio } from "@/concept/studio/use-studio";
import { Avatar } from "@/concept/ui/avatar";
import { Button } from "@/concept/ui/button";
import { Card } from "@/concept/ui/card";
import { EmptyState } from "@/concept/ui/empty-state";
import { ListRow } from "@/concept/ui/list-row";

/** Customers whose last visit is long ago. The owner decides for each: keep, move to the trash, or erase. Nothing here runs by itself. */
export default function ReviewPage() {
  const { state, today } = useStudio();
  const due = useMemo(() => customersDueForReview(state, today), [state, today]);
  const [erasing, setErasing] = useState<Customer | null>(null);

  const keep = (customer: Customer) =>
    dispatchWithUndoToast({ type: "customer/keep", id: customer.id, on: today }, t("review.kept", { name: customer.firstName, months: RETENTION.reviewAgainMonths }));
  const remove = (customer: Customer) =>
    dispatchWithUndoToast({ type: "customer/delete", id: customer.id }, t("customer.deletedToast", { name: customer.firstName, days: TRASH_DAYS }));

  return (
    <>
      <PageHeader
        title={t("review.title")}
        subtitle={tc("review.subtitle", due.length, { years: RETENTION.inactiveCustomerYears })}
        back={<BackLink href="/studio/customers" label={t("review.back")} />}
      />
      <div className="space-y-4 md:max-w-3xl">
        <p className="text-body text-text-secondary">{t("review.intro")}</p>
        {due.length ? (
          <Card className="divide-y divide-hairline overflow-hidden">
            {due.map(({ customer, lastActivity, neverVisited }) => (
              <div key={customer.id} className="space-y-2 pb-3">
                <ListRow href={`/studio/customers/${customer.id}`}
                  leading={<Avatar name={fullName(customer)} />}
                  title={<span className="min-w-0 break-words">{fullName(customer)}</span>}
                  meta={t(neverVisited ? "review.never" : "review.last", { date: formatDate(lastActivity) })} />
                <div className="flex flex-wrap gap-2 px-4">
                  <Button size="sm" variant="secondary" icon={<Check size={16} />} onClick={() => keep(customer)}>{t("review.keep")}</Button>
                  <Button size="sm" variant="secondary" icon={<Trash2 size={16} />} onClick={() => remove(customer)}>{t("review.delete")}</Button>
                  <Button size="sm" variant="danger" icon={<Eraser size={16} />} onClick={() => setErasing(customer)}>{t("review.erase")}</Button>
                </div>
              </div>
            ))}
          </Card>
        ) : (
          <EmptyState icon={<UserRoundCheck size={22} />} title={t("review.empty")} text={t("review.emptyText", { years: RETENTION.inactiveCustomerYears })} />
        )}
      </div>
      {erasing && <EraseCustomerSheet customer={erasing} open onClose={() => setErasing(null)} onErased={() => setErasing(null)} />}
    </>
  );
}
