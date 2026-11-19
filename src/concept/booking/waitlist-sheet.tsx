"use client";

import { useState } from "react";
import { BellRing, CheckCircle2 } from "lucide-react";
import { t } from "../i18n";
import { formatDayLong } from "../i18n/format";
import { findService } from "../selectors";
import { currentState, dispatch } from "../store";
import type { DateKey, DemoState, StaffId } from "../data/types";
import { Button } from "../ui/button";
import type { Now } from "../use-now";
import { Sheet } from "../ui/sheet";
import { GuestFields, RememberContact, isGuestValid } from "./guest-fields";
import { findCustomerByPhone } from "./lookup";
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

/** "Notify me if something opens up": leaves a request in the owner's Inbox. */
export function WaitlistSheet({ state, now, request, onClose }: WaitlistSheetProps) {
  const { guest, setGuest, remember, chooseRemember, saveContact } = useGuestContact(state.salon.slug);
  const [done, setDone] = useState(false);
  const service = request ? findService(state, request.serviceId) : undefined;
  const person = state.staff.find(s => s.id === request?.staffId);
  const serviceLabel = service && (person ? t("booking.waitlist.withStaff", { service: service.name, staff: person.firstName }) : service.name);

  const close = () => {
    setDone(false);
    onClose();
  };

  const submit = () => {
    if (!request || !service || !serviceLabel) return;
    const day = formatDayLong(request.date);
    const phone = guest.phone.trim();
    const joined = dispatch({
      type: "online/waitlist",
      guest: { name: guest.name, phone, at: { date: now.today, time: now.minutes } },
      serviceId: service.id,
      staffId: request.staffId,
      notice: {
        title: t("booking.waitlist.inboxTitle", { service: service.name }),
        body: t("booking.waitlist.inboxBody", { name: guest.name.trim(), service: serviceLabel, day, phone }),
        draftReply: t("booking.waitlist.inboxReply", { name: guest.name.trim().split(/\s+/)[0], service: serviceLabel }),
      },
    });
    if (!joined) return;
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
            <Button icon={<BellRing size={16} />} disabled={!isGuestValid(guest)} onClick={submit}>{t("booking.waitlist.submit")}</Button>
          </>
        )
      }
    >
      {done ? (
        <div className="flex items-start gap-3 py-3 text-[15px]">
          <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-action" />
          <p>{t("booking.waitlist.doneBody", { phone: guest.phone.trim() })}</p>
        </div>
      ) : (
        <div className="pt-2">
          <GuestFields value={guest} onChange={setGuest} />
          <RememberContact checked={remember} onChange={chooseRemember} />
        </div>
      )}
    </Sheet>
  );
}
