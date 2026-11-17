"use client";

import { useState } from "react";
import { formatTime } from "../../data/dates";
import { needOf } from "../../data/slots";
import type { DateKey, StaffId } from "../../data/types";
import { t } from "../../i18n";
import { formatDayLong, formatDuration, formatMoney } from "../../i18n/format";
import { findCustomer, fullName } from "../../selectors";
import { dispatch, undo } from "../../store";
import { Avatar } from "../../ui/avatar";
import { Button } from "../../ui/button";
import { SearchInput } from "../../ui/controls";
import { cx } from "../../ui/cx";
import { Sheet } from "../../ui/sheet";
import { showToast } from "../../ui/toast";
import { useStudio } from "../use-studio";
import { SlotPicker, type Slot } from "./slot-picker";

export interface NewBookingPreset {
  customerId?: string;
  serviceId?: string;
  staffId?: StaffId;
  date?: DateKey;
  start?: number;
}

/** Book a customer: pick customer, treatment and a free time. */
export function NewBookingSheet({ preset, onClose }: { preset: NewBookingPreset; onClose: () => void }) {
  const { state, today } = useStudio();
  const [customerId, setCustomerId] = useState(preset.customerId);
  const [query, setQuery] = useState("");
  const firstService =
    state.services.find((s) => s.id === preset.serviceId) ??
    state.services.find((s) => s.staffIds.includes(preset.staffId ?? findCustomer(state, preset.customerId)?.preferredStaff ?? "anna"))!;
  const [serviceId, setServiceId] = useState(firstService.id);
  const service = state.services.find((s) => s.id === serviceId)!;
  const staffId = service.staffIds[0];
  const [date, setDate] = useState(preset.date ?? today);
  const [slot, setSlot] = useState<Slot | null>(
    preset.date !== undefined && preset.start !== undefined ? { date: preset.date, start: preset.start } : null,
  );
  const customer = findCustomer(state, customerId);
  const q = query.trim().toLowerCase();
  const matches = q
    ? state.customers.filter((c) => fullName(c).toLowerCase().includes(q) || c.phone.replace(/\s/g, "").includes(q.replace(/\s/g, ""))).slice(0, 6)
    : [];

  const book = () => {
    if (!customer || !slot) return;
    const ok = dispatch({ type: "booking/create", customerId: customer.id, serviceId, staffId, date: slot.date, start: slot.start, source: "phone" });
    if (ok) {
      showToast(t("newBooking.bookedToast", { name: customer.firstName, when: `${formatDayLong(slot.date)} ${formatTime(slot.start)}` }), {
        label: t("common.undo"),
        run: undo,
      });
      onClose();
    } else {
      showToast(t("newBooking.slotTaken"));
      setSlot(null);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={t("newBooking.title")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={!customer || !slot} onClick={book}>
            {slot ? t("newBooking.confirmAt", { time: formatTime(slot.start) }) : t("newBooking.confirm")}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <section className="space-y-2">
          <h3 className="text-sm font-medium">{t("newBooking.customer")}</h3>
          {customer ? (
            <div className="flex items-center gap-3 rounded-2xl bg-eko-sunken p-3">
              <Avatar name={fullName(customer)} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{fullName(customer)}</p>
                <p className="text-sm text-eko-muted">{customer.phone}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setCustomerId(undefined)}>{t("common.change")}</Button>
            </div>
          ) : (
            <div className="space-y-2">
              <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("newBooking.searchCustomer")} autoFocus />
              {matches.length > 0 && (
                <ul className="divide-y divide-eko-line overflow-hidden rounded-2xl ring-1 ring-eko-line">
                  {matches.map((c) => (
                    <li key={c.id}>
                      <button onClick={() => { setCustomerId(c.id); setQuery(""); }} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-eko-sunken">
                        <Avatar name={fullName(c)} size="sm" />
                        <span className="min-w-0 flex-1 truncate">{fullName(c)}</span>
                        <span className="text-sm text-eko-muted">{c.phone}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {q && !matches.length && <p className="text-sm text-eko-muted">{t("newBooking.noMatch")}</p>}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">{t("newBooking.treatment")}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {state.services.map((s) => (
              <button
                key={s.id}
                aria-pressed={s.id === serviceId}
                onClick={() => { setServiceId(s.id); setSlot(null); }}
                className={cx(
                  "flex min-h-12 items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm ring-1 ring-inset",
                  s.id === serviceId ? "bg-eko-accent-soft ring-eko-accent" : "bg-eko-surface ring-eko-line hover:bg-eko-sunken",
                )}
              >
                <span className="min-w-0">
                  <span className="block font-medium leading-snug">{s.name}</span>
                  <span className="block text-xs text-eko-muted">
                    {formatDuration(s.duration)} · {state.staff.find((p) => p.id === s.staffIds[0])?.firstName}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-eko-muted">{formatMoney(s.price)}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">{t("newBooking.time")}</h3>
          <SlotPicker staffId={staffId} need={needOf(service)} date={date} onDateChange={setDate} value={slot} onChange={setSlot} />
        </section>
      </div>
    </Sheet>
  );
}
