import { useState } from "react";
import Link from "next/link";
import { CalendarHeart, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { monthGrid, shiftMonth, type CalendarDay } from "../../campaigns/calendar";
import { prefillForHoliday, studioHref } from "../../campaigns/prefill";
import type { DateKey } from "../../data/types";
import { t, words } from "../../i18n";
import { formatDate, formatMonth } from "../../i18n/format";
import { Badge } from "../../ui/badge";
import { ButtonLink, IconButton } from "../../ui/button";
import { Card } from "../../ui/card";
import { cx } from "../../ui/cx";
import { useStudio } from "../use-studio";

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Month view: holidays and planned posts. Tap a day to see what is on it. */
export function ContentCalendar() {
  const { state, today } = useStudio();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState<DateKey>(today);
  const weeks = monthGrid(month, state.holidays, state.campaigns);
  const day = weeks.flat().find((d) => d.date === selected) ?? weeks[0][0];
  const planned = new Set(state.campaigns.map((c) => c.holidayId));

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-2 py-2">
        <IconButton label={t("campaigns.calendar.previous")} onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={20} /></IconButton>
        <h3 className="font-semibold">{`${formatMonth(month)} ${month.slice(0, 4)}`}</h3>
        <IconButton label={t("campaigns.calendar.next")} onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={20} /></IconButton>
      </div>
      <div className="grid grid-cols-7 border-t border-eko-line px-1.5 pt-1.5 text-center text-[11px] font-semibold uppercase text-eko-muted">
        {WEEKDAY_ORDER.map((wd) => <span key={wd}>{words.weekdaysShort[wd].slice(0, 2)}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5 p-1.5">
        {weeks.flat().map((d) => (
          <DayCell key={d.date} day={d} today={today} selected={selected === d.date} onSelect={() => setSelected(d.date)} />
        ))}
      </div>
      <div className="space-y-3 border-t border-eko-line p-4">
        <p className="text-sm font-semibold">{formatDate(day.date)}</p>
        {!day.holidays.length && !day.posts.length && <p className="text-sm text-eko-muted">{t("campaigns.calendar.empty")}</p>}
        {day.holidays.map((h) => (
          <div key={h.id} className="flex flex-wrap items-center gap-2">
            <span className="flex min-w-0 flex-1 basis-40 items-center gap-2 text-sm"><CalendarHeart size={16} className="shrink-0 text-eko-accent" />{h.name}</span>
            {planned.has(h.id) ? (
              <Badge tone="accent">{t("campaigns.planned")}</Badge>
            ) : (
              <ButtonLink size="sm" variant="secondary" href={studioHref(prefillForHoliday(state, h, today), true)}>{t("campaigns.create")}</ButtonLink>
            )}
          </div>
        ))}
        {day.posts.map((p) => (
          <Link key={p.campaignId} href={`/studio/more/campaigns/${p.campaignId}`} className="flex flex-wrap items-center gap-2 text-sm hover:underline">
            <span className="min-w-0 flex-1 basis-40 font-medium">{p.name}</span>
            <span className="text-eko-muted">{p.channels.map((c) => t(`channel.${c}`)).join(", ")}</span>
          </Link>
        ))}
        {day.date >= today && (
          <ButtonLink size="sm" variant="ghost" icon={<Plus size={16} />} href="/studio/more/campaigns/new">{t("campaigns.calendar.plan")}</ButtonLink>
        )}
      </div>
    </Card>
  );
}

function DayCell({ day, today, selected, onSelect }: { day: CalendarDay; today: DateKey; selected: boolean; onSelect: () => void }) {
  const number = Number(day.date.slice(8));
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={formatDate(day.date)}
      className={cx(
        "flex min-h-12 flex-col items-center justify-start gap-1 rounded-xl pt-1.5 text-sm transition-colors",
        day.inMonth ? "text-eko-ink" : "text-eko-muted/50",
        selected ? "bg-eko-accent-soft ring-1 ring-inset ring-eko-accent" : "hover:bg-eko-sunken",
        day.date === today && "font-semibold",
      )}
    >
      <span className={cx("flex size-6 items-center justify-center rounded-full", day.date === today && "bg-eko-accent text-eko-on-accent")}>{number}</span>
      <span className="flex h-1.5 gap-0.5">
        {day.holidays.length > 0 && <span className="size-1.5 rounded-full bg-eko-warn" />}
        {day.posts.length > 0 && <span className="size-1.5 rounded-full bg-eko-accent" />}
      </span>
    </button>
  );
}
