"use client";

import { useState } from "react";
import { BellRing, CheckCircle2 } from "lucide-react";
import type { DateKey, DemoState, StaffId } from "../data/types";
import { t } from "../i18n";
import { customerText } from "../i18n/customer-text";
import { formatDayLong } from "../i18n/format";
import { serviceCopy } from "../i18n/salon-eko-copy";
import { findService } from "../selectors";
import { targetOf } from "../store";
import { commitAction } from "../store/commit";
import { newActionRequestId } from "../support/action-reference";
import { ActionFailure, type ActionFailureInfo } from "../ui/action-failure";
import { Button } from "../ui/button";
import type { Now } from "../use-now";
import { Sheet } from "../ui/sheet";
import { useCommit } from "../ui/use-commit";
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
  const [failure, setFailure] = useState<ActionFailureInfo>();
  const [run, pending] = useCommit();
  const service = request ? findService(state, request.serviceId) : undefined;
  const person = state.staff.find(s => s.id === request?.staffId);
  const serviceLabel = service && (person ? t("booking.waitlist.withStaff", { service: service.name, staff: person.firstName }) : service.name);

  const close = () => {
    setDone(false);
    onClose();
  };

  const submit = () => run(async () => {
    const target = targetOf(state);
    if (!request || !service || !serviceLabel) return;
    const day = formatDayLong(request.date);
    const name = guest.name.trim();
    const phone = guest.phone.trim();
    const treatment = serviceCopy(service, state.localization.language).name;
    const replyService = person
      ? customerText(state, "booking.waitlist.withStaff", { service: treatment, staff: person.firstName })
      : treatment;
    const joined = target && await commitAction(target, {
      type: "online/waitlist",
      guest: { name, phone, at: { date: now.today, time: now.minutes } },
      serviceId: service.id,
      staffId: request.staffId,
      notice: {
        title: t("booking.waitlist.inboxTitle", { service: service.name }),
        body: t("booking.waitlist.inboxBody", { name, service: serviceLabel, day, phone }),
        draftReply: customerText(state, "booking.waitlist.inboxReply", { name: name.split(/\s+/)[0], service: replyService }),
      },
    }).catch(() => null);
    if (!joined?.ok) {
      setFailure({ requestId: newActionRequestId(), reason: "booking.waitlist.failed" });
      return;
    }
    // The contact the request created or matched, in the state this request saved.
    const customer = findCustomerByPhone(joined.state, phone);
    if (customer) saveContact(customer.id);
    setDone(true);
  });

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
            <Button icon={<BellRing size={16} />} disabled={pending || !isGuestValid(guest)} onClick={submit}>{t("booking.waitlist.submit")}</Button>
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
        <div className="space-y-3 pt-2">
          <GuestFields value={guest} onChange={setGuest} />
          <RememberContact checked={remember} onChange={chooseRemember} />
          {failure && <ActionFailure failure={failure} audience="booking" />}
        </div>
      )}
    </Sheet>
  );
}
