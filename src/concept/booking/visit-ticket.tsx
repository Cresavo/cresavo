import type { ReactNode } from "react";
import type { DateKey } from "../data/types";
import { t } from "../i18n";
import { formatDayLong, formatDuration, formatTime } from "../i18n/format";
import { Card } from "../ui/card";
import { mapLink } from "./links";

interface VisitTicketProps {
  treatment: string;
  date: DateKey;
  start: number;
  duration: number;
  /** Who the customer is going to, as the page knows them. */
  staff: ReactNode;
  place: { name?: string; address: string; area?: string };
  visitFor?: string;
  /** What the visit costs, under the rows. */
  children?: ReactNode;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-3 py-3">
      <dt className="text-meta text-text-secondary">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

/** The visit as a quiet ticket: what and with whom, then date, time and place as label–value rows. The address opens the map. */
export function VisitTicket({ treatment, date, start, duration, staff, place, visitFor, children }: VisitTicketProps) {
  const address = [place.address, place.area].filter(Boolean).join(", ");
  return (
    <Card className="space-y-4 p-5">
      <div className="space-y-3">
        <div>
          <p className="text-h3 font-semibold">{treatment}</p>
          {visitFor && <p className="mt-1 text-body">{t("booking.for.visit", { name: visitFor })}</p>}
        </div>
        {staff}
      </div>
      <dl className="divide-y divide-hairline border-t border-hairline text-body">
        <Row label={t("booking.ticket.date")}>{formatDayLong(date)}</Row>
        <Row label={t("booking.ticket.time")}>
          <span className="tabular-nums">{formatTime(start)}–{formatTime(start + duration)}</span>
          <span className="text-text-secondary"> · {formatDuration(duration)}</span>
        </Row>
        <Row label={t("booking.ticket.place")}>
          {place.name && <span className="block">{place.name}</span>}
          <a href={mapLink(place.address, place.area)} target="_blank" rel="noopener noreferrer" className="font-medium text-action underline underline-offset-2 [overflow-wrap:anywhere]">
            {address}
            <span className="sr-only"> ({t("booking.openMap")})</span>
          </a>
        </Row>
      </dl>
      {children}
    </Card>
  );
}
