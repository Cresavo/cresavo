"use client";

import { formatTime } from "../../i18n/format";
import type { DragEvent } from "react";
import { processingGap } from "../../data/slots";
import type { Booking } from "../../data/types";
import { findCustomer, findService, fullName } from "../../selectors";
import { t } from "../../i18n";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { cx } from "../../ui/cx";
import { useStudio } from "../use-studio";

export const DRAG_TYPE = "application/x-eko-booking";

interface BookingBlockProps {
  booking: Booking;
  top: number;
  height: number;
  /** Pixels per minute of the column, to place the processing gap and buffers. */
  scale: number;
  compact?: boolean;
  /** The booking lies outside the plan (someone is off, the salon is closed) and needs moving. */
  misfit?: boolean;
  onOpen: () => void;
}

/** A booking positioned in a time column. Draggable on devices with a mouse. */
export function BookingBlock({ booking, top, height, scale, compact, misfit, onOpen }: BookingBlockProps) {
  const { state } = useStudio();
  const customer = findCustomer(state, booking.customerId);
  const service = findService(state, booking.serviceId);
  const gap = processingGap(service, booking.start, booking.duration);
  const buffers = [
    { key: "before", minutes: service?.bufferBefore ?? 0, style: { bottom: "100%", height: (service?.bufferBefore ?? 0) * scale } },
    { key: "after", minutes: service?.bufferAfter ?? 0, style: { top: "100%", height: (service?.bufferAfter ?? 0) * scale } },
  ].filter((buffer) => buffer.minutes > 0);
  const anna = booking.staffId === "anna";
  const onDragStart = (event: DragEvent) => {
    event.dataTransfer.setData(DRAG_TYPE, booking.id);
    event.dataTransfer.effectAllowed = "move";
  };
  return (
    <div className="absolute inset-x-1" style={{ top, height }}>
      <Button
        variant="tertiary"
        size="sm"
        align="start"
        draggable
        onDragStart={onDragStart}
        onClick={onOpen}
        className={cx(
          "h-full w-full !items-start overflow-hidden border-l-2 !px-1 !text-minimum",
          anna ? "border-staff-1 bg-staff-1-bg" : "border-staff-2 bg-staff-2-bg",
          misfit && "ring-2 ring-danger",
        )}
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold">{customer ? (compact ? customer.firstName : fullName(customer)) : ""}</span>
          <span className="block truncate text-text-secondary">
            {formatTime(booking.start)}
            {!compact && ` · ${service?.name}`}
          </span>
          {gap && <span className="sr-only">{t("calendar.processing", { from: formatTime(gap.start), to: formatTime(gap.end) })}</span>}
          {misfit && <Badge tone="warn" className="max-w-full">
            <span className="truncate">{t("calendar.needsMoving")}</span>
          </Badge>}
        </span>
      </Button>
      {gap && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--ui-border)_6px_7px)]"
          style={{ top: (gap.start - booking.start) * scale, height: (gap.end - gap.start) * scale }}
        />
      )}
      {buffers.map(({ key, style }) => (
        <div key={key} aria-hidden className="pointer-events-none absolute inset-x-0 border-x border-dashed border-hairline bg-surface-2/60" style={style} />
      ))}
    </div>
  );
}
