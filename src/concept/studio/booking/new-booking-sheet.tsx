"use client";

import { customerDraft, isContactPhone, phoneMatches } from "../../booking/lookup";
import { useState } from "react";
import { preferredStaffOf } from "../../assistant/memory";
import { GuestFields } from "../../booking/guest-fields";
import { isFree, needOf } from "../../data/slots";
import type { DateKey, StaffId } from "../../data/types";
import { staffViewer } from "../../ops/access";
import { useRole } from "../../ops/role";
import { t } from "../../i18n";
import { formatDayLong, formatDuration, formatMoney, formatTime } from "../../i18n/format";
import { findCustomer, fullName } from "../../selectors";
import { dispatchWithLog, withBookingLock } from "../../store";
import { Avatar } from "../../ui/avatar";
import { Button } from "../../ui/button";
import { Field, SearchInput, Select, TextInput } from "../../ui/controls";
import { cx } from "../../ui/cx";
import { Notice } from "../../ui/notice";
import { Sheet } from "../../ui/sheet";
import { useStudio } from "../use-studio";
import { SlotPicker, slotOnDate, type Slot } from "./slot-picker";
import { showUndoToast } from "../log/undo-toast";

export interface NewBookingPreset {
  customerId?: string;
  customerQuery?: string;
  newCustomer?: { name: string; phone: string };
  serviceId?: string;
  staffId?: StaffId;
  date?: DateKey;
  start?: number;
}

/** Book a customer: pick customer, treatment and a free time. */
export function NewBookingSheet({ preset, onClose }: { preset: NewBookingPreset; onClose: () => void }) {
  const { state, today, minutes } = useStudio();
  const [customerId, setCustomerId] = useState(preset.customerId);
  const [query, setQuery] = useState(preset.customerQuery ?? "");
  const [adding, setAdding] = useState(!!preset.newCustomer);
  const [guest, setGuest] = useState(preset.newCustomer ?? { name: "", phone: "" });
  const [email, setEmail] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const presetCustomer = findCustomer(state, preset.customerId);
  const viewer = useRole() === "staff" ? staffViewer(state) : null;
  const services = viewer ? state.services.filter(service => service.staffIds.includes(viewer.id)) : state.services;
  const firstService =
    services.find((s) => s.id === preset.serviceId) ??
    services.find((s) => preset.staffId && preset.date && preset.start !== undefined &&
      s.staffIds.includes(preset.staffId) && isFree(state, preset.staffId, preset.date, preset.start, needOf(s))) ??
    services.find((s) => s.staffIds.includes(preset.staffId ?? (presetCustomer ? preferredStaffOf(state, presetCustomer) : "anna"))) ??
    (preset.staffId && !viewer ? undefined : services[0]);
  const [serviceId, setServiceId] = useState(firstService?.id);
  const service = services.find((s) => s.id === serviceId) ?? firstService;
  const [chosenStaff, setChosenStaff] = useState<string | undefined>(preset.staffId);
  const staffId = viewer?.id ?? service?.staffIds.find(id => id === chosenStaff) ?? service?.staffIds[0];
  const [date, setDate] = useState(preset.date ?? today);
  const [picked, setSlot] = useState<(Slot & { staffId?: StaffId }) | null>(
    preset.date !== undefined && preset.start !== undefined ? { date: preset.date, start: preset.start, staffId: preset.staffId } : null,
  );
  const slot = slotOnDate(picked, date);
  const customer = findCustomer(state, customerId);
  const q = query.trim().toLowerCase();
  const matches = q
    ? state.customers.filter((c) => fullName(c).toLowerCase().includes(q) || phoneMatches(c.phone, q)).slice(0, 6)
    : [];

  if (!service || !staffId) {
    const person = viewer ?? state.staff.find((person) => person.id === preset.staffId);
    return <Sheet open onClose={onClose} title={t("newBooking.title")}>
      <Notice tone="info">{person ? t("newBooking.noStaffTreatments", { name: person.firstName }) : t("newBooking.noTreatments")}</Notice>
    </Sheet>;
  }

  const fits = !!slot && (!slot.staffId || slot.staffId === staffId) && slot.date >= today && (slot.date !== today || slot.start >= minutes) &&
    isFree(state, staffId, slot.date, slot.start, needOf(service));
  const contactValid = guest.name.trim().length >= 2 && isContactPhone(guest.phone);
  const emailValid = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const guestValid = contactValid && emailValid;
  const reason = failed ? t("newBooking.slotTaken") : slot && !fits ? t("newBooking.doesNotFit") : undefined;

  const book = async () => {
    if (pending || !slot || !fits || (!customer && (!adding || !guestValid))) return;
    const contact = customer ? { customerId: customer.id } : { newCustomer: { ...guest, email, since: today } };
    setPending(true);
    const logId = await withBookingLock(() => dispatchWithLog({ type: "booking/create", ...contact, serviceId: service.id, staffId, date: slot.date, start: slot.start, source: "phone" }));
    setPending(false);
    if (logId === false) {
      setFailed(true);
      return;
    }
    showUndoToast(t("newBooking.bookedToast", { name: customer?.firstName ?? guest.name.trim().split(/\s+/)[0], when: `${formatDayLong(slot.date)} ${formatTime(slot.start)}` }), logId);
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={t("newBooking.title")}
      footer={
        <>
          {/* What will be booked, in full, right next to the button that books it. */}
          <p className="w-full text-[15px]" aria-live="polite">
            <span className="font-medium">{service.name}</span>
            <span className="text-text-secondary">
              {" · "}{formatDuration(service.duration)} · {state.staff.find((p) => p.id === staffId)?.firstName} · {formatMoney(service.price)}
              {slot && ` · ${formatDayLong(slot.date)} ${formatTime(slot.start)}`}
            </span>
          </p>
          {reason && <Notice tone="info" role="status" className="w-full">{reason}</Notice>}
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={pending || !fits || failed || (!customer && (!adding || !guestValid))} onClick={book}>
            {slot ? t("newBooking.confirmAt", { time: formatTime(slot.start) }) : t("newBooking.confirm")}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <section className="space-y-2">
          <h3 className="text-sm font-medium">{t("newBooking.customer")}</h3>
          {customer ? (
            <div className="flex items-center gap-3 rounded-lg bg-surface-2 p-3">
              <Avatar name={fullName(customer)} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{fullName(customer)}</p>
                <p className="text-sm text-text-secondary">{customer.phone}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setCustomerId(undefined)}>{t("common.change")}</Button>
            </div>
          ) : adding ? (
            <div className="space-y-3">
              <GuestFields staffEntry value={guest} onChange={setGuest} />
              <Field label={t("newBooking.emailOptional")} hint={emailValid ? undefined : t("newBooking.invalidEmail")}>
                <TextInput type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>{t("newBooking.findExisting")}</Button>
            </div>
          ) : (
            <div className="space-y-2">
              <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("newBooking.searchCustomer")} autoFocus />
              {matches.length > 0 && (
                <ul className="divide-y divide-hairline overflow-hidden rounded-lg ring-1 ring-hairline">
                  {matches.map((c) => (
                    <li key={c.id}>
                      <button onClick={() => { setCustomerId(c.id); setQuery(""); }} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-2">
                        <Avatar name={fullName(c)} size="sm" />
                        <span className="min-w-0 flex-1 truncate">{fullName(c)}</span>
                        <span className="text-sm text-text-secondary">{c.phone}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {q && !matches.length && <p className="text-sm text-text-secondary">{t("newBooking.noMatch")}</p>}
              <Button variant="secondary" size="sm" onClick={() => {
                setGuest(customerDraft(query));
                setAdding(true);
              }}>{t("newBooking.addCustomer")}</Button>
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">{t("newBooking.treatment")}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {services.map((s) => (
              <button
                key={s.id}
                aria-pressed={s.id === service.id}
                onClick={() => { setServiceId(s.id); setFailed(false); }}
                className={cx(
                  "flex min-h-12 items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm ring-1 ring-inset",
                  s.id === service.id ? "bg-action-bg ring-action" : "bg-surface ring-hairline hover:bg-surface-2",
                )}
              >
                <span className="min-w-0">
                  <span className="block font-medium leading-snug">{s.name}</span>
                  <span className="block text-xs text-text-secondary">
                    {formatDuration(s.duration)} · {state.staff.filter(p => s.staffIds.includes(p.id) && (!viewer || p.id === viewer.id)).map(p => p.firstName).join(", ")}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-text-secondary">{formatMoney(s.price)}</span>
              </button>
            ))}
          </div>
        </section>

        {!viewer && service.staffIds.length > 1 && <Field label={t("calendar.staff")}>
          <Select value={staffId} onChange={e => { setChosenStaff(e.target.value); setSlot(null); setFailed(false); }}>
            {state.staff.filter(person => service.staffIds.includes(person.id)).map(person =>
              <option key={person.id} value={person.id}>{fullName(person)}</option>)}
          </Select>
        </Field>}
        <section className="space-y-2">
          <h3 className="text-sm font-medium">{t("newBooking.time")}</h3>
          <SlotPicker staffId={staffId} need={needOf(service)} date={date} onDateChange={(next) => { setDate(next); setSlot(null); setFailed(false); }} value={slot} onChange={(next) => { setSlot({ ...next, staffId }); setFailed(false); }} />
        </section>
      </div>
    </Sheet>
  );
}
