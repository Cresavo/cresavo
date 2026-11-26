"use client";

import type { ReactNode } from "react";
import { bookingMessage, type BookingMessageKind } from "../../booking/messages";
import type { Booking, DemoState } from "../../data/types";
import { getActiveLocale, t } from "../../i18n";
import type { MessageKey } from "../../i18n";
import { formatDate, formatMoney, formatTime } from "../../i18n/format";
import { findCustomer, findService, visitorName } from "../../selectors";
import { cx } from "../../ui/cx";
import type { CallOutcome } from "../../receptionist/types";

/** Visual-only previews of the SMS and e-mail the customer would receive. Nothing is sent. */
export function messageKindFor(outcome: CallOutcome): BookingMessageKind | null {
  if (outcome === "booked") return "confirmation";
  if (outcome === "moved") return "moved";
  if (outcome === "cancelled") return "cancellation";
  return null;
}

const TITLE: Record<Exclude<CallOutcome, "none" | "handover">, MessageKey> = {
  booked: "webCall.booking.booked",
  moved: "webCall.booking.moved",
  cancelled: "webCall.booking.cancelled",
};

export function bookingDetails(state: DemoState, booking: Booking) {
  const language = getActiveLocale();
  const customer = findCustomer(state, booking.customerId);
  const service = findService(state, booking.serviceId);
  const staff = state.staff.find((person) => person.id === booking.staffId);
  return {
    service: service?.name ?? "",
    when: `${formatDate(booking.date, language)} ${formatTime(booking.start, language)}`,
    price: formatMoney(booking.price, state.localization.currency, language),
    name: visitorName(booking, customer),
    staff: staff?.firstName ?? "",
  };
}

function SlideIn({ children, instant }: { children: ReactNode; instant?: boolean }) {
  return <div className={cx("w-full text-left", !instant && "maja-slide")}>{children}</div>;
}

export function BookingResult({
  state,
  booking,
  outcome,
  instant,
  previews = true,
}: {
  state: DemoState;
  booking: Booking;
  outcome: "booked" | "moved" | "cancelled";
  instant?: boolean;
  previews?: boolean;
}) {
  const details = bookingDetails(state, booking);
  const kind = messageKindFor(outcome);
  const previewState = { ...state, localization: { ...state.localization, language: getActiveLocale() } };
  const message = kind ? bookingMessage(previewState, booking, kind) : null;
  return (
    <SlideIn instant={instant}>
      <section className="w-full space-y-4 text-left" aria-live="polite">
        <h2 className="font-medium text-h3">{t(TITLE[outcome])}</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body">
          {details.service && <><dt className="text-text-secondary">{t("webCall.booking.service")}</dt><dd>{details.service}</dd></>}
          {details.when && <><dt className="text-text-secondary">{t("webCall.booking.when")}</dt><dd>{details.when}</dd></>}
          {details.price && <><dt className="text-text-secondary">{t("webCall.booking.price")}</dt><dd>{details.price}</dd></>}
          {details.name && <><dt className="text-text-secondary">{t("webCall.booking.name")}</dt><dd>{details.name}</dd></>}
        </dl>
        {previews && message && (
          <div className="space-y-5">
            <MessagePreview title={t("webCall.preview.sms")} body={message.body} />
            <MessagePreview title={t("webCall.preview.email")} subject={message.subject} body={message.body} />
          </div>
        )}
      </section>
    </SlideIn>
  );
}

export function HandoverResult({ reason, instant }: { reason?: string; instant?: boolean }) {
  if (!reason) return null;
  return (
    <SlideIn instant={instant}>
      <section className="w-full space-y-2 text-left" aria-live="polite">
        <h2 className="font-medium text-h3">{t("webCall.handover.card")}</h2>
        <p className="whitespace-pre-line text-body">{reason}</p>
      </section>
    </SlideIn>
  );
}

function MessagePreview({ title, subject, body }: { title: string; subject?: string; body: string }) {
  return (
    <div className="space-y-2">
      <h3 className="text-meta font-medium text-text-secondary">{title}</h3>
      {subject && <p className="text-body font-medium">{subject}</p>}
      <p className="whitespace-pre-line text-body text-text-secondary [overflow-wrap:anywhere]">{body}</p>
    </div>
  );
}
