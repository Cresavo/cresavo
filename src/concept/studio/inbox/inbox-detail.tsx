"use client";

import { offerSlotToWaitlist } from "../booking/offer-waitlist";
import { waitlistCount } from "../booking/waitlist-notice";
import { useState } from "react";
import { CalendarCheck, Send } from "lucide-react";
import { bookingLink } from "../../customers/return-visits";
import { inboxTimestamp } from "../../data/dates";
import type { InboxItem } from "../../data/types";
import { t } from "../../i18n";
import { customerText } from "../../i18n/customer-text";
import { formatDayLong, relativeDay, formatTime } from "../../i18n/format";
import { findCustomer, findService } from "../../selectors";
import { newActionRequestId } from "../../support/action-reference";
import { ActionFailure, type ActionFailureInfo } from "../../ui/action-failure";
import { Badge, DemoBadge } from "../../ui/badge";
import { Button, ButtonLink } from "../../ui/button";
import { TextArea } from "../../ui/controls";
import { useStudio } from "../use-studio";
import { InboxAvatar, KIND_LABEL, KindIcon, senderName } from "./inbox-meta";
import { ApproveReview } from "../reviews/approve-review";
import { liveSlot } from "./live-slot";
import { dispatchWithUndoToast } from "../log/undo-toast";

/** One message with a drafted reply (and time) that can be sent with one tap. */
export function InboxDetail({ item, onDone }: { item: InboxItem; onDone?: () => void }) {
  const { state, today, minutes } = useStudio();
  const at = inboxTimestamp(item, today, minutes);
  const review = item.reviewId ? state.reviews.find((r) => r.id === item.reviewId) : undefined;
  const [reply, setReply] = useState(() => item.draftReply ?? (review
    ? customerText(state, review.rating >= 4 ? "reviews.draftHappy" : "reviews.draftUnhappy", { name: findCustomer(state, review.customerId)?.firstName ?? "" })
    : ""));
  const [failure, setFailure] = useState<ActionFailureInfo>();
  const slot = item.suggestion && !item.handled ? liveSlot(state, item.suggestion, today, minutes, item.bookingId) : undefined;
  const staff = slot ? state.staff.find((s) => s.id === slot.staffId) : undefined;
  const booking = item.bookingId ? state.bookings.find((b) => b.id === item.bookingId) : undefined;
  const name = senderName(state, item) ?? t("inbox.system");
  const savedReply = review?.reply ?? (item.handled ? item.reply : undefined);
  const canReply = review ? !savedReply : !item.handled && !!item.draftReply;

  const send = () => {
    const sent = review
      ? dispatchWithUndoToast({ type: "review/reply", id: review.id, reply: reply.trim() }, t("reviews.replied"))
      : dispatchWithUndoToast({ type: "inbox/reply", id: item.id, reply: reply.trim(), slot }, slot ? t("inbox.sentWithBooking", { name: name.split(" ")[0] }) : t("inbox.sent"));
    if (sent) onDone?.();
    else setFailure({ requestId: newActionRequestId(), reason: slot ? "inbox.sendBookingFailed" : "messages.failed" });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <InboxAvatar state={state} item={item} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{name}</p>
          <p className="text-sm text-text-secondary">
            {relativeDay(at.date, today)} {review
              ? `· ${t(review.source === "Google" ? "reviews.source.google" : "reviews.source.bookingPage")}`
              : formatTime(at.time)}
          </p>
        </div>
        <Badge>
          <KindIcon kind={item.kind} size={12} />
          {t(KIND_LABEL[item.kind])}
        </Badge>
      </div>

      <div className="whitespace-pre-line rounded-lg rounded-tl-sm bg-surface-2 px-4 py-3 text-body leading-relaxed">
        {review && <p role="img" className="mb-1 text-warning" aria-label={t("inbox.stars", { count: review.rating })}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p>}
        {item.body}
      </div>
      {item.delivery && <Badge tone="accent">{t("common.simulated")} · {t(`messages.channel.${item.delivery.channel}`)}</Badge>}
      {review && <ApproveReview review={review} />}
      {item.recallServiceId && (
        <ButtonLink href={bookingLink(state, item.recallServiceId)} variant="secondary" size="sm">{t("inbox.openBookingLink")}</ButtonLink>
      )}

      {booking && (
        <p className="flex items-center gap-2 text-sm text-text-secondary">
          <CalendarCheck size={16} />
          {t("inbox.aboutBooking", {
            service: findService(state, booking.serviceId)?.name ?? "",
            when: `${formatDayLong(booking.date)} ${formatTime(booking.start)}`,
          })}
          {booking.status === "cancelled" && <Badge tone="danger">{t("status.cancelled")}</Badge>}
        </p>
      )}

      {savedReply && (
        <div className="ml-8 max-w-reading rounded-lg rounded-tr-sm bg-action-bg px-4 py-3 text-body leading-relaxed">
          <p className="mb-1 text-xs font-semibold text-action">{t("inbox.yourReply")}</p>
          {savedReply}
        </div>
      )}

      {canReply && (
        <div className="space-y-3 md:max-w-form">
          <p className="flex items-center gap-2 text-xs font-semibold text-action">
            {t("inbox.suggestedReply")}
          </p>
          {slot && staff && (
            <div className="flex items-center gap-3 rounded-md bg-action-bg px-3 py-3 text-sm">
              <CalendarCheck size={18} className="shrink-0 text-action" />
              <span>
                {item.kind === "reschedule" ? t("inbox.slotMove") : t("inbox.slotBook")}{" "}
                <strong>{formatDayLong(slot.date)} {formatTime(slot.start)}</strong>
                {" · "}
                {findService(state, slot.serviceId)?.name} {t("inbox.withStaff", { name: staff.firstName })}
              </span>
            </div>
          )}
          <TextArea value={reply} onChange={(e) => setReply(e.target.value)} aria-label={t("inbox.suggestedReply")} />
          {failure && <ActionFailure failure={failure} />}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <DemoBadge short />
            {item.kind === "cancel" && booking && waitlistCount(state, booking) > 0 && (
              <Button
                variant="secondary"
                onClick={() => {
                  if (!offerSlotToWaitlist(booking, { today, minutes })) {
                    setFailure({ requestId: newActionRequestId(), reason: "messages.failed" });
                  }
                }}
              >
                {t("inbox.offerSlot")}
              </Button>
            )}
            <Button data-help-id="inbox.reply" icon={<Send size={16} />} disabled={!reply.trim()} onClick={send}>
              {review ? t("reviews.publish") : slot ? t("inbox.sendAndBook") : t("inbox.send")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
