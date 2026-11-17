"use client";

import { useState, type ReactNode } from "react";
import { CalendarHeart, Clock, Megaphone, MessageSquare, Package, UserRoundCheck, X } from "lucide-react";
import { prefillForHoliday, studioHref } from "../../campaigns/prefill";
import { quietDay } from "../../campaigns/quiet-day";
import { diffDays } from "../../data/dates";
import { freeGaps } from "../../data/slots";
import { t, tc } from "../../i18n";
import { weekdayName } from "../../i18n/format";
import { buildCustomerStats, lowStock, recallDue } from "../../selectors";
import { dispatch, undo } from "../../store";
import { Button, ButtonLink, IconButton } from "../../ui/button";
import { Card } from "../../ui/card";
import { showToast } from "../../ui/toast";
import type { OpenSheet } from "../booking/booking-sheets";
import { useStudio } from "../use-studio";

const VISIBLE_AT_FIRST = 3;
const QUIET_DISCOUNT = 10;

interface Suggestion {
  id: string;
  icon: ReactNode;
  title: string;
  text: string;
  actions: ReactNode;
}

/** Proactive cards: things the system noticed and proposes. Nothing changes until the owner taps. */
export function Suggestions({ onOpen }: { onOpen: (sheet: OpenSheet) => void }) {
  const { state, today, minutes } = useStudio();
  const [showAll, setShowAll] = useState(false);
  const list: Suggestion[] = [];
  const notify = (title: string, body: string, toast: string) => {
    dispatch({ type: "inbox/add", item: { kind: "system", date: today, time: minutes, title, body, read: false, handled: true } });
    showToast(toast, { label: t("common.undo"), run: undo });
  };

  const gaps = state.staff.flatMap((s) => freeGaps(state, s.id, today, { after: minutes, min: 30 }));
  const waitlist = state.customers.filter((c) => c.waitlist).length;
  if (gaps.length) {
    list.push({
      id: `gaps-${today}`,
      icon: <Clock size={20} />,
      title: tc("suggest.gaps.title", gaps.length),
      text: tc("suggest.gaps.text", waitlist),
      actions: (
        <>
          <Button size="sm" onClick={() => notify(t("suggest.gaps.sentTitle"), tc("suggest.gaps.sentBody", waitlist), tc("suggest.gaps.toast", waitlist))}>
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
      icon: <MessageSquare size={20} />,
      title: tc("suggest.inbox.title", unanswered),
      text: t("suggest.inbox.text"),
      actions: <ButtonLink href="/studio/inbox" size="sm">{t("suggest.inbox.open")}</ButtonLink>,
    });
  }

  if (state.modules.stock) {
    for (const item of lowStock(state).slice(0, 2)) {
      const days = Math.max(1, Math.round((item.inStock / item.usagePerWeek) * 7));
      list.push({
        id: `stock-${item.id}-${today}`,
        icon: <Package size={20} />,
        title: t("suggest.stock.title", { name: item.name }),
        text: tc("suggest.stock.text", item.inStock, { days }),
        actions: <ButtonLink href="/studio/more/stock" size="sm">{t("suggest.stock.order")}</ButtonLink>,
      });
    }
  }

  const due = recallDue(state, buildCustomerStats(state, today), today);
  if (due.length) {
    list.push({
      id: `recall-${today}`,
      icon: <UserRoundCheck size={20} />,
      title: tc("suggest.recall.title", due.length),
      text: t("suggest.recall.text"),
      actions: (
        <>
          <Button size="sm" onClick={() => notify(t("suggest.recall.sentTitle"), tc("suggest.recall.sentBody", due.length), tc("suggest.recall.toast", due.length))}>
            {t("suggest.recall.send")}
          </Button>
          <ButtonLink href="/studio/customers?filter=due" size="sm" variant="ghost">{t("suggest.recall.show")}</ButtonLink>
        </>
      ),
    });
  }

  const holiday = state.modules.campaigns
    ? state.holidays.find((h) => diffDays(h.date, today) <= h.leadDays + 7)
    : undefined;
  if (holiday) {
    list.push({
      id: `holiday-${holiday.id}`,
      icon: <CalendarHeart size={20} />,
      title: tc("suggest.holiday.title", diffDays(holiday.date, today), { name: holiday.name }),
      text: holiday.idea,
      actions: <ButtonLink href={studioHref(prefillForHoliday(state, holiday, today), true)} size="sm">{t("suggest.holiday.open")}</ButtonLink>,
    });
  }

  const quiet = state.modules.campaigns ? quietDay(state, today) : null;
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
      icon: <Megaphone size={20} />,
      title: t("suggest.quiet.title", { day: weekdayName(quiet.date), hours: Math.round(quiet.freeMinutes / 60) }),
      text: t("suggest.quiet.text", { percent: QUIET_DISCOUNT, service: quiet.service.name }),
      actions: <ButtonLink href={studioHref(prefill)} size="sm">{t("suggest.quiet.open")}</ButtonLink>,
    });
  }

  const visible = list.filter((s) => !state.dismissedCards.includes(s.id));
  if (!visible.length) return <p className="rounded-2xl bg-eko-sunken px-4 py-5 text-center text-sm text-eko-muted">{t("suggest.none")}</p>;

  const shown = showAll ? visible : visible.slice(0, VISIBLE_AT_FIRST);
  return (
    <div className="space-y-3">
      {shown.map((s) => (
        <Card key={s.id} className="p-4">
          <div className="flex gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-eko-accent-soft text-eko-accent">{s.icon}</span>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-eko-accent">{t("suggest.label")}</p>
              <p className="font-medium leading-snug">{s.title}</p>
              <p className="text-sm text-eko-muted">{s.text}</p>
              <div className="flex flex-wrap gap-2 pt-2">{s.actions}</div>
            </div>
            <IconButton label={t("suggest.dismiss")} onClick={() => dispatch({ type: "card/dismiss", id: s.id })} className="-mr-2 -mt-2 size-9">
              <X size={16} />
            </IconButton>
          </div>
        </Card>
      ))}
      {shown.length < visible.length && (
        <Button variant="ghost" className="w-full" onClick={() => setShowAll(true)}>
          {tc("suggest.more", visible.length - shown.length)}
        </Button>
      )}
    </div>
  );
}
