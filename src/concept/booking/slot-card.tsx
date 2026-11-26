import { WithStaff } from "./with-staff";
import { ChevronRight } from "lucide-react";
import type { DateKey, DemoState, Service } from "../data/types";
import { t } from "../i18n";
import { formatDayShort, formatDuration, formatMoney, relativeDay, formatTime } from "../i18n/format";
import { ListRow } from "../ui/list-row";
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
    <ListRow
      onClick={onPick}
      className="bg-surface ring-1 ring-inset ring-input-border"
      leading={
        <span className="flex shrink-0 flex-col items-center rounded-md bg-surface-2 px-2 py-2 text-text">
          <span className="text-h2 font-semibold leading-tight">{formatTime(slot.start)}</span>
          <span className="text-meta">{t("booking.until", { time: formatTime(slot.start + service.duration) })}</span>
        </span>
      }
      title={day === formatDayShort(slot.date) ? day : `${day} · ${formatDayShort(slot.date)}`}
      meta={<>
        {person && <span className="mb-1 block text-text"><WithStaff people={[person]} size="sm" /></span>}
        {formatDuration(service.duration)} · {formatMoney(service.price)}
      </>}
      trailing={<ChevronRight size={20} className="shrink-0 text-text-secondary" aria-hidden />}
    />
  );
}
