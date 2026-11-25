"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { t } from "../../i18n";
import { dispatch } from "../../store";
import { showToast } from "../../ui/toast";
import { useStudio } from "../use-studio";
import { bookingNotices, noticeHref, type BookingNotice } from "./booking-notices";
import { noticeWhen } from "./notices-button";

const toastText = (notice: BookingNotice) =>
  t(`notices.toast.${notice.event}`, { name: notice.name || t("notices.someone"), service: notice.service, when: noticeWhen(notice) });

/**
 * A short toast when a customer books, cancels or moves while the studio is open, also from another
 * tab or window of this browser (the store follows the other tab's save). What was already there when
 * the studio opened is in "New since last time" instead, and each notice is shown once.
 */
export function NoticeToasts() {
  const { state } = useStudio();
  const router = useRouter();
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const notices = bookingNotices(state);
    if (!seen.current) {
      seen.current = new Set(notices.map((notice) => notice.id));
      return;
    }
    // Oldest first, so the newest ends up at the bottom of the stack.
    for (const notice of notices.filter((n) => !seen.current!.has(n.id)).reverse()) {
      seen.current.add(notice.id);
      showToast(toastText(notice), {
        label: t("notices.open"),
        run: () => {
          dispatch({ type: "inbox/read", id: notice.id });
          router.push(noticeHref(notice.bookingId));
        },
      });
    }
  }, [state, router]);
  return null;
}
