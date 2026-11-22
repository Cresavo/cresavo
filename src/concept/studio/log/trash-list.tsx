"use client";

import { useState } from "react";
import { Eraser, RotateCcw, Trash2 } from "lucide-react";
import type { Customer, DemoState } from "../../data/types";
import { t, tc } from "../../i18n";
import { formatDate, formatDayShort, formatTime } from "../../i18n/format";
import { findCustomer, findService, fullName } from "../../selectors";
import { dispatch } from "../../store";
import { daysLeft, restoreBlockReason, type TrashEntry } from "../../trash/trash";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { EmptyState } from "../../ui/empty-state";
import { showToast } from "../../ui/toast";
import { EraseCustomerSheet } from "../customers/erase-customer";
import { useStudio } from "../use-studio";

function describe(state: DemoState, entry: TrashEntry): { title: string; detail: string } {
  if (entry.kind === "customer") {
    return { title: fullName(entry.customer), detail: tc("trash.customerDetail", entry.bookings.length) };
  }
  const booking = state.bookings.find((b) => b.id === entry.bookingId);
  if (!booking) return { title: t("trash.booking"), detail: "" };
  const customer = findCustomer(state, booking.customerId);
  const service = findService(state, booking.serviceId);
  return {
    title: t("trash.bookingTitle", { customer: customer ? fullName(customer) : "", service: service?.name ?? "" }),
    detail: `${formatDayShort(booking.date)} ${formatTime(booking.start)}`,
  };
}

/** Cancelled bookings and deleted customers, kept for 30 days. */
export function TrashList() {
  const { state, today } = useStudio();
  const [erasing, setErasing] = useState<Customer | null>(null);
  if (!state.trash.length) return <EmptyState icon={<Trash2 size={22} />} title={t("trash.empty")} text={t("trash.emptyText")} />;

  const restore = (entry: TrashEntry) => showToast(dispatch({ type: "trash/restore", id: entry.id }) ? t("trash.restored") : t("trash.cannotRestore"));
  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondary">{t("trash.intro")}</p>
      <Card>
        <ul className="divide-y divide-hairline">
          {state.trash.map((entry) => {
            const { title, detail } = describe(state, entry);
            const blocked = restoreBlockReason(state, entry);
            const restorable = !blocked;
            return (
              <li key={entry.id} className="flex items-start gap-3 px-4 py-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-body font-medium leading-snug">{title}</p>
                  <p className="text-sm text-text-secondary">{detail}</p>
                  <p className="text-xs text-text-secondary">
                    {t(entry.kind === "customer" ? "trash.deleted" : "trash.cancelled", { date: formatDate(entry.deletedOn) })} · {tc("trash.daysLeft", daysLeft(entry, today))}
                    {blocked === "time-taken" && ` · ${t("trash.timeTaken")}`}
                    {blocked === "gift-card" && ` · ${t("trash.giftCardUsed")}`}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button size="sm" variant="secondary" icon={<RotateCcw size={16} />} disabled={!restorable} onClick={() => restore(entry)}>
                    {t("trash.restore")}
                  </Button>
                  {entry.kind === "customer" && (
                    <Button size="sm" variant="danger" icon={<Eraser size={16} />} onClick={() => setErasing(entry.customer)}>{t("review.erase")}</Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
      {erasing && <EraseCustomerSheet customer={erasing} open onClose={() => setErasing(null)} onErased={() => setErasing(null)} />}
    </div>
  );
}
