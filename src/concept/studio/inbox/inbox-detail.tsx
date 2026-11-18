"use client";

import { textWaitlistAboutSlot } from "../../booking/waitlist-offer";
import { waitlistCount, waitlistNotice } from "../booking/waitlist-notice";
import { useState } from "react";
import { CalendarCheck, Send } from "lucide-react";
import { bookingLink } from "../../customers/return-visits";
import { formatTime, inboxTimestamp } from "../../data/dates";
import type { InboxItem } from "../../data/types";
import { t, tc } from "../../i18n";
import { formatDayLong, relativeDay } from "../../i18n/format";
import { findService } from "../../selectors";
import { Badge } from "../../ui/badge";
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
  const [reply, setReply] = useState(item.draftReply ?? "");
  const slot = item.suggestion && !item.handled ? liveSlot(state, item.suggestion, today, minutes, item.bookingId) : undefined;
  const staff = slot ? state.staff.find((s) => s.id === slot.staffId) : undefined;
  const booking = item.bookingId ? state.bookings.find((b) => b.id === item.bookingId) : undefined;
  const review = item.reviewId ? state.reviews.find((r) => r.id === item.reviewId) : undefined;
  const name = senderName(state, item) ?? t("inbox.system");

  const send = () => {
    dispatchWithUndoToast({ type: "inbox/reply", id: item.id, reply: reply.trim(), slot }, slot ? t("inbox.sentWithBooking", { name: name.split(" ")[0] }) : t("inbox.sent"));
    onDone?.();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <InboxAvatar state={state} item={item} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{name}</p>
          <p className="text-sm text-text-secondary">
            {relativeDay(at.date, today)} {formatTime(at.time)}
          </p>
        </div>
        <Badge>
          <KindIcon kind={item.kind} size={12} />
          {t(KIND_LABEL[item.kind])}
        </Badge>
      </div>

      <div className="whitespace-pre-line rounded-lg rounded-tl-sm bg-surface-2 px-4 py-3 text-[15px] leading-relaxed">
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

      {item.handled && item.reply && (
        <div className="ml-8 rounded-lg rounded-tr-sm bg-action-bg px-4 py-3 text-[15px] leading-relaxed">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-action">{t("inbox.yourReply")}</p>
          {item.reply}
        </div>
      )}

      {!item.handled && item.draftReply && (
        <div className="space-y-3 rounded-lg p-4 ring-1 ring-action/30">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-action">
            {t("inbox.suggestedReply")}
          </p>
          {slot && staff && (
            <div className="flex items-center gap-3 rounded-md bg-action-bg px-3 py-2.5 text-sm">
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
          <div className="flex flex-wrap justify-end gap-2">
            {item.kind === "cancel" && booking && waitlistCount(state, booking) > 0 && (
              <Button
                variant="secondary"
                onClick={() => {
                  const waitlist = waitlistCount(state, booking);
                  if (!textWaitlistAboutSlot(state, booking)) return;
                  dispatchWithUndoToast({ type: "inbox/add", item: waitlistNotice(booking, waitlist, { today, minutes }) }, tc("suggest.gaps.toast", waitlist));
                }}
              >
                {t("inbox.offerSlot")}
              </Button>
            )}
            <Button icon={<Send size={16} />} disabled={!reply.trim()} onClick={send}>
              {slot ? t("inbox.sendAndBook") : t("inbox.send")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
