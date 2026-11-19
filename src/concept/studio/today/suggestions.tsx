"use client";

import { useState, type ReactNode } from "react";
import { CalendarHeart, Clock, Megaphone, MessageSquare, Package, PackageCheck, UserRoundCheck, X } from "lucide-react";
import { prefillForHoliday, studioHref } from "../../campaigns/prefill";
import { textWaitlistAboutGaps } from "../../booking/waitlist-offer";
import { quietDay } from "../../campaigns/quiet-day";
import { diffDays } from "../../data/dates";
import { freeGaps } from "../../data/slots";
import { t, tc } from "../../i18n";
import { dueBackList } from "../../customers/return-visits";
import { formatAmount, formatDayMonth, weekdayName } from "../../i18n/format";
import { cardVisible, type TodayCard } from "../../modules/registry";
import { buildCustomerStats, lowStock } from "../../selectors";
import { overdueOrders } from "../../stock/delivery-note";
import { dispatch } from "../../store";
import { Button, ButtonLink, IconButton } from "../../ui/button";
import type { OpenSheet } from "../booking/booking-sheets";
import { useForecasts } from "../stock/use-forecasts";
import { useStudio } from "../use-studio";
import { dispatchWithUndoToast } from "../log/undo-toast";
import { suggestionLimit } from "./limits";

const QUIET_DISCOUNT = 10;

interface Suggestion {
  id: string;
  /** The module card this belongs to; cards without one are always shown. */
  card?: TodayCard;
  icon: ReactNode;
  title: string;
  text: string;
  actions: ReactNode;
}

/**
 * Things the system noticed and proposes, as rows for the attention card on Today. Nothing changes until the
 * owner taps. `silent` renders nothing when there is no suggestion (the card already says something).
 */
export function Suggestions({ onOpen, silent }: { onOpen: (sheet: OpenSheet) => void; silent?: boolean }) {
  const { state, today, minutes } = useStudio();
  const [showAll, setShowAll] = useState(false);
  const list: Suggestion[] = [];
  const notify = (title: string, body: string, toast: string) => {
    if (!textWaitlistAboutGaps(state, today)) return;
    dispatchWithUndoToast({ type: "inbox/add", item: { kind: "system", waitlistOffer: true, date: today, time: minutes, title, body, read: false, handled: true } }, toast);
  };

  const lowItems = cardVisible(state.modules, "stock-low") ? lowStock(state).slice(0, 2) : [];
  const forecasts = useForecasts(lowItems);
  const gaps = state.staff.flatMap((s) => freeGaps(state, s.id, today, { after: minutes, min: 30 }));
  const waitlist = state.customers.filter((c) => c.waitlist).length;
  if (gaps.length) {
    list.push({
      id: `gaps-${today}`,
      card: "gaps",
      icon: <Clock size={18} />,
      title: tc("suggest.gaps.title", gaps.length),
      text: tc("suggest.gaps.text", waitlist),
      actions: (
        <>
          <Button size="sm" variant="secondary" onClick={() => notify(t("suggest.gaps.sentTitle"), tc("suggest.gaps.sentBody", waitlist), tc("suggest.gaps.toast", waitlist))}>
            {t("suggest.gaps.send")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onOpen({ kind: "phone" })}>{t("suggest.gaps.show")}</Button>
        </>
      ),
    });
  }

  const unanswered = state.inbox.filter((i) => !i.handled && (i.kind === "request" || i.kind === "reschedule")).length;
  if (unanswered) {
    list.push({
      id: `inbox-${today}`,
      icon: <MessageSquare size={18} />,
      title: tc("suggest.inbox.title", unanswered),
      text: t("suggest.inbox.text"),
      actions: <ButtonLink href="/studio/inbox" size="sm" variant="secondary">{t("suggest.inbox.open")}</ButtonLink>,
    });
  }

  lowItems.forEach((item, i) => {
    const days = forecasts[i].daysRemaining ?? 0;
    list.push({
      id: `stock-${item.id}-${today}`,
      card: "stock-low",
      icon: <Package size={18} />,
      title: t("suggest.stock.title", { name: item.name }),
      text: tc("suggest.stock.text", item.inStock, { count: formatAmount(item.inStock), days: Math.max(1, days) }),
      actions: <ButtonLink href="/studio/more/stock?order=1" size="sm" variant="secondary">{t("suggest.stock.order")}</ButtonLink>,
    });
  });
  for (const order of overdueOrders(state, today).slice(0, 1)) {
    list.push({
      id: `delivery-${order.id}`,
      card: "stock-delivery",
      icon: <PackageCheck size={18} />,
      title: t("suggest.stock.delivery.title", { supplier: order.supplier }),
      text: t("suggest.stock.delivery.text", { date: formatDayMonth(order.date) }),
      actions: <ButtonLink href={`/studio/more/stock?receive=${order.id}`} size="sm" variant="secondary">{t("suggest.stock.delivery.action")}</ButtonLink>,
    });
  }

  const due = dueBackList(state, buildCustomerStats(state, today), today);
  if (due.length) {
    list.push({
      id: `recall-${today}`,
      icon: <UserRoundCheck size={18} />,
      title: tc("suggest.recall.title", due.length),
      text: t("suggest.recall.text"),
      actions: <ButtonLink href="/studio/customers/due-back" size="sm" variant="secondary">{t("suggest.recall.review")}</ButtonLink>,
    });
  }

  const holiday = cardVisible(state.modules, "holiday")
    ? [...state.holidays].sort((a, b) => a.date.localeCompare(b.date)).find((h) => h.date >= today && diffDays(h.date, today) <= h.leadDays + 7)
    : undefined;
  if (holiday) {
    list.push({
      id: `holiday-${holiday.id}`,
      card: "holiday",
      icon: <CalendarHeart size={18} />,
      title: tc("suggest.holiday.title", diffDays(holiday.date, today), { name: holiday.name }),
      text: holiday.idea,
      actions: <ButtonLink href={studioHref(prefillForHoliday(state, holiday, today), true)} size="sm" variant="secondary">{t("suggest.holiday.open")}</ButtonLink>,
    });
  }

  const quiet = cardVisible(state.modules, "quiet-day") ? quietDay(state, today) : null;
  if (quiet) {
    const prefill = {
      name: t("campaigns.name.discount", { percent: QUIET_DISCOUNT, service: quiet.service.name }),
      serviceIds: [quiet.service.id],
      discountPercent: QUIET_DISCOUNT,
      from: today,
      to: quiet.date,
    };
    list.push({
      id: `quiet-${quiet.date}`,
      card: "quiet-day",
      icon: <Megaphone size={18} />,
      title: t("suggest.quiet.title", { day: weekdayName(quiet.date), hours: Math.round(quiet.freeMinutes / 60) }),
      text: t("suggest.quiet.text", { percent: QUIET_DISCOUNT, service: quiet.service.name }),
      actions: <ButtonLink href={studioHref(prefill)} size="sm" variant="secondary">{t("suggest.quiet.open")}</ButtonLink>,
    });
  }

  const visible = list.filter((s) => (!s.card || cardVisible(state.modules, s.card)) && !state.dismissedCards.includes(s.id));
  if (!visible.length) return silent ? null : <p className="px-4 py-5 text-center text-sm text-text-secondary">{t("suggest.none")}</p>;

  // The most pressing first and the rest a tap away, so Today stays the schedule. A new salon gets one.
  const limit = suggestionLimit(state);
  const shown = showAll ? visible : visible.slice(0, limit.first);
  return (
    <>
      {shown.map((s) => (
        <div key={s.id} className="flex gap-3 py-4 pl-4 pr-1">
          <span aria-hidden className="mt-1 shrink-0 text-text-secondary">{s.icon}</span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-medium leading-snug">{s.title}</p>
            <p className="text-sm text-text-secondary">{s.text}</p>
            <div className="flex flex-wrap gap-2 pt-2">{s.actions}</div>
          </div>
          <IconButton label={t("suggest.dismiss")} onClick={() => dispatch({ type: "card/dismiss", id: s.id })} className="-mt-2 shrink-0">
            <X size={16} />
          </IconButton>
        </div>
      ))}
      {limit.more && shown.length < visible.length && (
        <div>
          <Button variant="tertiary" className="w-full rounded-none text-text-secondary" onClick={() => setShowAll(true)}>
            {tc("suggest.more", visible.length - shown.length)}
          </Button>
        </div>
      )}
    </>
  );
}
