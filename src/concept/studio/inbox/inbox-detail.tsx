"use client";

import { useState } from "react";
import { CalendarCheck, Send, Sparkles } from "lucide-react";
import { bookingLink } from "../../customers/return-visits";
import { formatTime } from "../../data/dates";
import type { InboxItem } from "../../data/types";
import { t, tc } from "../../i18n";
import { formatDayLong, relativeDay } from "../../i18n/format";
import { findService } from "../../selectors";
import { dispatch, undo } from "../../store";
import { Badge } from "../../ui/badge";
import { Button, ButtonLink } from "../../ui/button";
import { TextArea } from "../../ui/controls";
import { showToast } from "../../ui/toast";
import { useStudio } from "../use-studio";
import { InboxAvatar, KIND_LABEL, KindIcon, senderName } from "./inbox-meta";
import { liveSlot } from "./live-slot";

/** One message with a drafted reply (and time) that can be sent with one tap. */
export function InboxDetail({ item, onDone }: { item: InboxItem; onDone?: () => void }) {
  const { state, today, minutes } = useStudio();
  const [reply, setReply] = useState(item.draftReply ?? "");
  const slot = item.suggestion && !item.handled ? liveSlot(state, item.suggestion, today, minutes, item.bookingId) : undefined;
  const staff = slot ? state.staff.find((s) => s.id === slot.staffId) : undefined;
  const booking = item.bookingId ? state.bookings.find((b) => b.id === item.bookingId) : undefined;
  const review = item.reviewId ? state.reviews.find((r) => r.id === item.reviewId) : undefined;
  const name = senderName(state, item) ?? t("inbox.system");

  const send = () => {
    dispatch({ type: "inbox/reply", id: item.id, reply: reply.trim(), slot });
    showToast(slot ? t("inbox.sentWithBooking", { name: name.split(" ")[0] }) : t("inbox.sent"), { label: t("common.undo"), run: undo });
    onDone?.();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <InboxAvatar state={state} item={item} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{name}</p>
          <p className="text-sm text-eko-muted">
            {relativeDay(item.date, today)} {formatTime(item.time)}
          </p>
        </div>
        <Badge>
          <KindIcon kind={item.kind} size={12} />
          {t(KIND_LABEL[item.kind])}
        </Badge>
      </div>

      <div className="rounded-2xl rounded-tl-md bg-eko-sunken px-4 py-3 text-[15px] leading-relaxed">
        {review && <p className="mb-1 text-eko-warn" aria-label={t("inbox.stars", { count: review.rating })}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p>}
        {item.body}
      </div>
      {item.recallServiceId && (
        <ButtonLink href={bookingLink(state, item.recallServiceId)} variant="secondary" size="sm">{t("inbox.openBookingLink")}</ButtonLink>
      )}

      {booking && (
        <p className="flex items-center gap-2 text-sm text-eko-muted">
          <CalendarCheck size={16} />
          {t("inbox.aboutBooking", {
            service: findService(state, booking.serviceId)?.name ?? "",
            when: `${formatDayLong(booking.date)} ${formatTime(booking.start)}`,
          })}
          {booking.status === "cancelled" && <Badge tone="danger">{t("status.cancelled")}</Badge>}
        </p>
      )}

      {item.handled && item.reply && (
        <div className="ml-8 rounded-2xl rounded-tr-md bg-eko-accent-soft px-4 py-3 text-[15px] leading-relaxed">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-eko-accent">{t("inbox.yourReply")}</p>
          {item.reply}
        </div>
      )}

      {!item.handled && item.draftReply && (
        <div className="space-y-3 rounded-2xl p-4 ring-1 ring-eko-accent/30">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-eko-accent">
            <Sparkles size={14} />
            {t("inbox.suggestedReply")}
          </p>
          {slot && staff && (
            <div className="flex items-center gap-3 rounded-xl bg-eko-accent-soft px-3 py-2.5 text-sm">
              <CalendarCheck size={18} className="shrink-0 text-eko-accent" />
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
            {item.kind === "cancel" && booking && (
              <Button
                variant="secondary"
                onClick={() => {
                  const waitlist = state.customers.filter((c) => c.waitlist).length;
                  dispatch({
                    type: "inbox/add",
                    item: {
                      kind: "system",
                      date: today,
                      time: minutes,
                      title: t("cancel.offerTitle", { time: formatTime(booking.start) }),
                      body: tc("cancel.offerBody", waitlist, { day: formatDayLong(booking.date), time: formatTime(booking.start) }),
                      read: false,
                      handled: true,
                    },
                  });
                  showToast(tc("suggest.gaps.toast", waitlist), { label: t("common.undo"), run: undo });
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
