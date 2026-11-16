import { ChevronRight } from "lucide-react";
import { formatTime } from "../data/dates";
import type { DateKey, DemoState, Service } from "../data/types";
import { t } from "../i18n";
import { formatDayShort, formatDuration, formatMoney, relativeDay } from "../i18n/format";
import type { OpenSlot } from "./suggest";

interface SlotCardProps {
  slot: OpenSlot;
  service: Service;
  staff: DemoState["staff"];
  today: DateKey;
  onPick: () => void;
}

/** One suggested time. The whole card is the button. */
export function SlotCard({ slot, service, staff, today, onPick }: SlotCardProps) {
  const person = staff.find((s) => s.id === slot.staffId);
  const day = relativeDay(slot.date, today);
  return (
    <button
      onClick={onPick}
      className="flex w-full items-center gap-4 rounded-2xl bg-eko-surface p-4 text-left ring-1 ring-inset ring-eko-line transition-colors hover:bg-eko-accent-soft hover:ring-eko-accent"
    >
      <span className="flex w-20 shrink-0 flex-col items-center rounded-xl bg-eko-accent-soft py-2 text-eko-accent">
        <span className="text-xl font-semibold leading-tight">{formatTime(slot.start)}</span>
        <span className="text-xs">{formatTime(slot.start + service.duration)}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{day === formatDayShort(slot.date) ? day : `${day} · ${formatDayShort(slot.date)}`}</span>
        <span className="mt-1 block text-sm text-eko-muted">{t("booking.withStaff", { name: person?.firstName ?? "" })}</span>
        <span className="block text-sm text-eko-muted">{formatDuration(service.duration)} · {formatMoney(service.price)}</span>
      </span>
      <ChevronRight size={20} className="shrink-0 text-eko-muted" aria-hidden />
    </button>
  );
}
