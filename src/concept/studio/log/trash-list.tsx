"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import type { DemoState } from "../../data/types";
import { t, tc } from "../../i18n";
import { formatDate, formatDayShort, formatTime } from "../../i18n/format";
import { findCustomer, findService, fullName } from "../../selectors";
import { dispatch } from "../../store";
import { daysLeft, restoreBlockReason, type TrashEntry } from "../../trash/trash";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { EmptyState } from "../../ui/empty-state";
import { showToast } from "../../ui/toast";
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
              <li key={entry.id} className="flex items-start gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-[15px] font-medium leading-snug">{title}</p>
                  <p className="text-sm text-text-secondary">{detail}</p>
                  <p className="text-xs text-text-secondary">
                    {t(entry.kind === "customer" ? "trash.deleted" : "trash.cancelled", { date: formatDate(entry.deletedOn) })} · {tc("trash.daysLeft", daysLeft(entry, today))}
                    {blocked === "time-taken" && ` · ${t("trash.timeTaken")}`}
                    {blocked === "gift-card" && ` · ${t("trash.giftCardUsed")}`}
                  </p>
                </div>
                <Button size="sm" variant="secondary" icon={<RotateCcw size={16} />} disabled={!restorable} onClick={() => restore(entry)}>
                  {t("trash.restore")}
                </Button>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
