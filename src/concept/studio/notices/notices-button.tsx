"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CalendarCheck, CalendarClock, CalendarX, ChevronRight } from "lucide-react";
import { formatMinor } from "../../booking/policy-summary";
import { useRole } from "../../ops/role";
import { Avatar } from "../../ui/avatar";
import { t, tc } from "../../i18n";
import { formatDayShort, formatTime } from "../../i18n/format";
import { dispatch } from "../../store";
import { Button } from "../../ui/button";
import { cx } from "../../ui/cx";
import { SuccessCheck } from "../../ui/feedback";
import { ListRow } from "../../ui/list-row";
import { Sheet } from "../../ui/sheet";
import { useStudio } from "../use-studio";
import { canSeeBookingNotices, noticeHref, visibleBookingNotices, type BookingNotice } from "./booking-notices";

const ICONS = { booked: CalendarCheck, cancelled: CalendarX, moved: CalendarClock } as const;

/** "Maja booked Gel polish", with "A customer" when the card is gone. */
export const noticeTitle = (notice: BookingNotice) =>
  t(`notices.${notice.event}`, { name: notice.name || t("notices.someone"), service: notice.service });

export const noticeWhen = (notice: Pick<BookingNotice, "date" | "start">) =>
  t("notices.when", { day: formatDayShort(notice.date), time: formatTime(notice.start) });

/** How long the check stays in the pill after the last notice is seen, before the bell comes back. */
const CLEARED_MS = 1600;
const FACES = 3;

/** The people behind the newest notices, once each: their initials stack in the pill. */
function faces(notices: BookingNotice[]): string[] {
  return [...new Set(notices.map((notice) => notice.fullName).filter(Boolean))].slice(0, FACES);
}

/**
 * "New since last time" in the studio's top bar. While customers have booked, cancelled or moved a visit since the
 * owner last looked, a compact pill stacks their initials beside the count; it opens the list. When the last one is
 * seen the pill holds a quiet check for a moment, then the bell is back. The Inbox badge keeps the count too.
 */
export function NoticesButton() {
  const { state, today } = useStudio();
  const role = useRole();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const notices = visibleBookingNotices(state, role);
  const count = notices.length;
  const [shown, setShown] = useState(count);
  const [cleared, setCleared] = useState(false);
  if (shown !== count) {
    setShown(count);
    setCleared(shown > 0 && count === 0);
  }
  useEffect(() => {
    if (!cleared) return;
    const timer = setTimeout(() => setCleared(false), CLEARED_MS);
    return () => clearTimeout(timer);
  }, [cleared]);
  if (!canSeeBookingNotices(role)) return null;
  const show = (notice: BookingNotice) => {
    dispatch({ type: "inbox/read", id: notice.id });
    setOpen(false);
    router.push(noticeHref(notice.bookingId));
  };
  const label = count ? `${t("notices.title")}: ${tc("notices.count", count)}` : t("notices.title");
  const people = faces(notices);
  return (
    <>
      <Button variant="tertiary" size="sm" aria-label={label} title={label} onClick={() => setOpen(true)} data-testid="notices-button"
        className="shrink-0 px-1 text-text-secondary hover:text-text">
        {count > 0 ? (
          <span key="new" aria-hidden className="ui-arrive flex items-center gap-1 rounded-full bg-surface py-1 pl-1 pr-1 ring-1 ring-inset ring-hairline">
            {people.length ? (
              <span className="flex -space-x-2">
                {people.map((name, i) => (
                  <Avatar key={name} name={name} size="xs" className={cx("ring-2 ring-surface", i > 0 && "max-[374px]:hidden")} />
                ))}
              </span>
            ) : <Bell size={18} className="mx-1" />}
            <span className="studio-highlight min-w-6 rounded-full px-2 text-center text-meta font-semibold tabular-nums">{count}</span>
          </span>
        ) : cleared ? (
          <span key="cleared" aria-hidden className="flex items-center rounded-full bg-surface p-1 ring-1 ring-inset ring-hairline"><SuccessCheck /></span>
        ) : (
          <Bell key="bell" size={22} aria-hidden />
        )}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("notices.title")} description={t("notices.description")}
        footer={notices.length > 0 ? (
          <Button variant="secondary" width="responsive" onClick={() => {
            notices.forEach((notice) => dispatch({ type: "inbox/read", id: notice.id }));
            setOpen(false);
          }}>
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
