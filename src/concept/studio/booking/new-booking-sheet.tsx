"use client";

import { ListRow } from "../../ui/list-row";
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
import { newActionRequestId } from "../../support/action-reference";
import { ActionFailure, type ActionFailureInfo } from "../../ui/action-failure";
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
  const [failure, setFailure] = useState<ActionFailureInfo>();
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
  const reason = slot && !fits ? t("newBooking.doesNotFit") : undefined;

  const book = async () => {
    if (pending || !slot || !fits || (!customer && (!adding || !guestValid))) return;
    const contact = customer ? { customerId: customer.id } : { newCustomer: { ...guest, email, since: today } };
    const requestId = newActionRequestId();
    setPending(true);
    const logId = await withBookingLock(() => dispatchWithLog({ type: "booking/create", ...contact, serviceId: service.id, staffId, date: slot.date, start: slot.start, source: "phone" })).catch(() => false as const);
    setPending(false);
    if (logId === false) {
      setFailure({ requestId, reason: "newBooking.slotTaken" });
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
          <p className="w-full text-body" aria-live="polite">
            <span className="font-medium">{service.name}</span>
            <span className="text-text-secondary">
              {" · "}{formatDuration(service.duration)} · {state.staff.find((p) => p.id === staffId)?.firstName} · {formatMoney(service.price)}
              {slot && ` · ${formatDayLong(slot.date)} ${formatTime(slot.start)}`}
            </span>
          </p>
          {failure ? <ActionFailure failure={failure} /> : reason && <Notice tone="info" role="status" className="w-full">{reason}</Notice>}
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={pending || !fits || (!customer && (!adding || !guestValid))} onClick={book}>
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
              <Field width="short" label={t("newBooking.emailOptional")} hint={emailValid ? undefined : t("newBooking.invalidEmail")}>
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
                      <ListRow onClick={() => { setCustomerId(c.id); setQuery(""); }} title={fullName(c)}
                        leading={<Avatar name={fullName(c)} size="sm" />}
                        trailing={<span className="text-meta text-text-secondary">{c.phone}</span>} />
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
              <Button
                key={s.id}
                variant="secondary"
                align="between"
                aria-pressed={s.id === service.id}
                onClick={() => { setServiceId(s.id); setFailure(undefined); }}
                className={cx(
                  "min-h-12",
                  s.id === service.id && "aria-pressed:bg-action-bg aria-pressed:ring-action",
                )}
              >
                <span className="min-w-0">
                  <span className="block font-medium leading-snug">{s.name}</span>
                  <span className="block text-xs text-text-secondary">
                    {formatDuration(s.duration)} · {state.staff.filter(p => s.staffIds.includes(p.id) && (!viewer || p.id === viewer.id)).map(p => p.firstName).join(", ")}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-text-secondary">{formatMoney(s.price)}</span>
              </Button>
            ))}
          </div>
        </section>

        {!viewer && service.staffIds.length > 1 && <Field width="short" label={t("calendar.staff")}>
          <Select value={staffId} onChange={e => { setChosenStaff(e.target.value); setSlot(null); setFailure(undefined); }}>
            {state.staff.filter(person => service.staffIds.includes(person.id)).map(person =>
              <option key={person.id} value={person.id}>{fullName(person)}</option>)}
          </Select>
        </Field>}
        <section className="space-y-2">
          <h3 className="text-sm font-medium">{t("newBooking.time")}</h3>
          <SlotPicker staffId={staffId} need={needOf(service)} date={date} onDateChange={(next) => { setDate(next); setSlot(null); setFailure(undefined); }} value={slot} onChange={(next) => { setSlot({ ...next, staffId }); setFailure(undefined); }} />
        </section>
      </div>
    </Sheet>
  );
}
