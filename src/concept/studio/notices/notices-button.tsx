"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CalendarCheck, CalendarClock, CalendarX, ChevronRight } from "lucide-react";
import { formatMinor } from "../../booking/policy-summary";
import { canOpen } from "../../ops/access";
import { useRole } from "../../ops/role";
import { t, tc } from "../../i18n";
import { formatDayShort, formatTime } from "../../i18n/format";
import { dispatch } from "../../store";
import { Button, IconButton } from "../../ui/button";
import { cx } from "../../ui/cx";
import { ListRow } from "../../ui/list-row";
import { Sheet } from "../../ui/sheet";
import { useStudio } from "../use-studio";
import { bookingNotices, noticeHref, type BookingNotice } from "./booking-notices";

const ICONS = { booked: CalendarCheck, cancelled: CalendarX, moved: CalendarClock } as const;

/** "Maja booked Gel polish", with "A customer" when the card is gone. */
export const noticeTitle = (notice: BookingNotice) =>
  t(`notices.${notice.event}`, { name: notice.name || t("notices.someone"), service: notice.service });

export const noticeWhen = (notice: Pick<BookingNotice, "date" | "start">) =>
  t("notices.when", { day: formatDayShort(notice.date), time: formatTime(notice.start) });

/**
 * The bell in the studio's top bar: a dot while customers have booked, cancelled or moved a visit
 * since the owner last looked, and the "New since last time" list. The Inbox badge keeps the count.
 */
export function NoticesButton() {
  const { state, today } = useStudio();
  const role = useRole();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (!canOpen(role, "/studio/inbox") || !canOpen(role, "/studio/calendar")) return null;
  const notices = bookingNotices(state);
  const show = (notice: BookingNotice) => {
    dispatch({ type: "inbox/read", id: notice.id });
    setOpen(false);
    router.push(noticeHref(notice.bookingId));
  };
  const label = notices.length ? `${t("notices.title")}: ${tc("notices.count", notices.length)}` : t("notices.title");
  return (
    <>
      <IconButton label={label} onClick={() => setOpen(true)} data-testid="notices-button" className="relative text-text-secondary hover:text-text">
        <Bell size={22} aria-hidden />
        {notices.length > 0 && <span aria-hidden className="ui-arrive absolute right-2 top-2 size-2 rounded-full bg-action" />}
      </IconButton>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("notices.title")} description={t("notices.description")}
        footer={notices.length > 0 ? (
          <Button variant="secondary" width="responsive" onClick={() => notices.forEach((notice) => dispatch({ type: "inbox/read", id: notice.id }))}>
            {t("notices.markSeen")}
          </Button>
        ) : undefined}>
        {notices.length ? (
          <ul className="-mx-4 pt-1">
            {notices.map((notice) => {
              const Icon = ICONS[notice.event];
              const paid = notice.paidMinor > 0 ? t("notices.paid", { amount: formatMinor(notice.paidMinor, notice.currency) }) : "";
              return (
                <li key={notice.id}>
                  <ListRow onClick={() => show(notice)} title={noticeTitle(notice)}
                    meta={[noticeWhen(notice), paid].filter(Boolean).join(" · ")}
                    leading={<Icon size={20} aria-hidden className={cx("shrink-0", notice.event === "booked" ? "text-action" : "text-text-secondary")} />}
                    trailing={<span className="flex shrink-0 items-center gap-1 text-meta text-text-secondary">
                      {notice.at.date === today ? formatTime(notice.at.time) : formatDayShort(notice.at.date)}
                      <ChevronRight size={18} aria-hidden />
                    </span>} />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="py-4 text-body text-text-secondary">{t("notices.empty")}</p>
        )}
      </Sheet>
    </>
  );
}
