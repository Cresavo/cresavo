"use client";

import { useState } from "react";
import { BellRing, CheckCircle2, X } from "lucide-react";
import { addDays, toMinutes } from "../data/dates";
import type { DateKey, DemoState, StaffId } from "../data/types";
import { t } from "../i18n";
import { customerText } from "../i18n/customer-text";
import { formatDayLong } from "../i18n/format";
import { serviceCopy } from "../i18n/salon-eko-copy";
import { findService } from "../selectors";
import { currentState, dispatchConfirmed } from "../store";
import { newActionRequestId } from "../support/action-reference";
import { ActionFailure, type ActionFailureInfo } from "../ui/action-failure";
import { Button, IconButton } from "../ui/button";
import { Checkbox, Field, Select, TextInput } from "../ui/controls";
import type { Now } from "../use-now";
import { Sheet } from "../ui/sheet";
import { GuestFields, RememberContact, isGuestValid } from "./guest-fields";
import { findCustomerByPhone } from "./lookup";
import { validPreferences } from "./waitlist-match";
import { ANY_TIME, MAX_REQUEST_DAYS } from "./waitlist-types";
import { useGuestContact } from "./guest";

export interface WaitlistRequest {
  serviceId: string;
  date: DateKey;
  staffId?: StaffId;
}

interface WaitlistSheetProps {
  state: DemoState;
  now: Now;
  request: WaitlistRequest | null;
  onClose: () => void;
}

/** "Notify me if something opens up": the days and times that suit the customer, a request in the owner's Inbox and a place in the queue. */
export function WaitlistSheet({ state, now, request, onClose }: WaitlistSheetProps) {
  const { guest, setGuest, remember, chooseRemember, saveContact } = useGuestContact(state.salon.slug);
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState<ActionFailureInfo>();
  const [pending, setPending] = useState(false);
  const [staffId, setStaffId] = useState(request?.staffId);
  const [days, setDays] = useState([request?.date ?? now.today]);
  const [anyTime, setAnyTime] = useState(true);
  const [from, setFrom] = useState("09:00");
  const [to, setTo] = useState("17:00");
  const service = request ? findService(state, request.serviceId) : undefined;
  const person = state.staff.find(s => s.id === staffId);
  const window = anyTime ? ANY_TIME : { start: from ? toMinutes(from) : -1, end: to ? (toMinutes(to) || 1440) : -1 };
  const valid = validPreferences(days, window, now.today);
  const serviceLabel = service && (person ? t("booking.waitlist.withStaff", { service: service.name, staff: person.firstName }) : service.name);

  const close = () => {
    setDone(false);
    onClose();
  };

  const submit = async () => {
    if (!request || !service || !serviceLabel || !valid || pending) return;
    const day = [...days].sort().map(d => formatDayLong(d)).join(", ");
    const name = guest.name.trim();
    const phone = guest.phone.trim();
    const treatment = serviceCopy(service, state.localization.language).name;
    const replyService = person
      ? customerText(state, "booking.waitlist.withStaff", { service: treatment, staff: person.firstName })
      : treatment;
    setPending(true);
    // Confirmed only once the request is saved: with another customer's offer out, writes wait for the booking lock.
    const joined = await dispatchConfirmed({
      type: "online/waitlist",
      guest: { name, phone, at: { date: now.today, time: now.minutes } },
      serviceId: service.id,
      staffId, days, window,
      notice: {
        title: t("booking.waitlist.inboxTitle", { service: service.name }),
        body: t("booking.waitlist.inboxBody", { name, service: serviceLabel, day, phone }),
        draftReply: customerText(state, "booking.waitlist.inboxReply", { name: name.split(/\s+/)[0], service: replyService }),
      },
    });
    setPending(false);
    if (!joined) {
      setFailure({ requestId: newActionRequestId(), reason: "booking.waitlist.failed" });
      return;
    }
    const customer = findCustomerByPhone(currentState() ?? state, phone);
    if (customer) saveContact(customer.id);
    setDone(true);
  };

  return (
    <Sheet
      open={!!request}
      onClose={close}
      title={done ? t("booking.waitlist.doneTitle") : t("booking.waitlist.title")}
      description={!done && serviceLabel && request ? t("booking.waitlist.intro", { service: serviceLabel, day: formatDayLong(request.date) }) : undefined}
      footer={
        done ? (
          <Button onClick={close}>{t("booking.waitlist.close")}</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>{t("common.cancel")}</Button>
            <Button icon={<BellRing size={16} />} disabled={!valid || !isGuestValid(guest)} loading={pending} onClick={submit}>{t("booking.waitlist.submit")}</Button>
          </>
        )
      }
    >
      {done ? (
        <div className="flex items-start gap-3 py-3 text-body">
          <CheckCircle2 size={22} className="mt-1 shrink-0 text-action" />
          <p>{t("booking.waitlist.doneBody", { phone: guest.phone.trim() })}</p>
        </div>
      ) : (
        <div className="space-y-4 pt-2">
          {service && service.staffIds.length > 1 && (
            <Field label={t("offers.staff")} width="short">
              <Select width="short" value={staffId ?? ""} onChange={e => setStaffId(service.staffIds.find(id => id === e.target.value))}>
                <option value="">{t("offers.anyStaff")}</option>
                {state.staff.filter(p => service.staffIds.includes(p.id)).map(p => <option key={p.id} value={p.id}>{p.firstName}</option>)}
              </Select>
            </Field>
          )}
          <fieldset className="space-y-2">
            <legend className="text-body font-medium">{t("offers.days")}</legend>
            {days.map((day, index) => (
              <div key={index} className="flex items-end gap-2">
                <TextInput type="date" width="date" aria-label={t("offers.day")} min={now.today} value={day}
                  onChange={e => setDays(days.map((d, i) => (i === index ? e.target.value : d)))} />
                {days.length > 1 && <IconButton label={t("offers.removeDay", { day: day ? formatDayLong(day) : "" })} onClick={() => setDays(days.filter((_, i) => i !== index))}><X size={18} /></IconButton>}
              </div>
            ))}
            {days.length < MAX_REQUEST_DAYS && (
              <Button variant="secondary" size="sm" onClick={() => setDays([...days, addDays([...days].filter(Boolean).sort().at(-1) ?? now.today, 1)])}>{t("offers.addDay")}</Button>
            )}
          </fieldset>
          <Checkbox label={t("offers.anyTimeChoice")} checked={anyTime} onChange={e => setAnyTime(e.target.checked)} />
          {!anyTime && (
            <div className="flex flex-wrap gap-4">
              <Field label={t("offers.from")} width="date"><TextInput type="time" width="date" value={from} onChange={e => setFrom(e.target.value)} /></Field>
              <Field label={t("offers.to")} width="date"><TextInput type="time" width="date" value={to} onChange={e => setTo(e.target.value)} /></Field>
            </div>
          )}
          <p className="text-meta text-text-secondary">{t("offers.consent")}</p>
          <GuestFields value={guest} onChange={setGuest} />
          <RememberContact checked={remember} onChange={chooseRemember} />
          {failure && <ActionFailure failure={failure} audience="booking" />}
        </div>
      )}
    </Sheet>
  );
}
