"use client";

import { formatTime } from "../../i18n/format";
import { useEffect, useRef, useState, type DragEvent, type RefObject } from "react";
import { processingGap } from "../../data/slots";
import type { Booking } from "../../data/types";
import { findCustomer, findService, visitorName } from "../../selectors";
import { t } from "../../i18n";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { cx } from "../../ui/cx";
import { minuteInGap } from "./gap";
import { accountRecordSettled } from "../../store";
import { useStudio } from "../use-studio";
import { useVisitActions } from "../booking/use-visit-actions";
import { hidePreview, PREVIEW_ID, previewBooking, usePreviewedId } from "./preview";

export const DRAG_TYPE = "application/x-eko-booking";

interface BookingBlockProps {
  booking: Booking;
  top: number;
  height: number;
  /** Pixels per minute of the column, to place the processing gap and buffers. */
  scale: number;
  compact?: boolean;
  /** Who the booking is with, said to assistive tech where the column does not already name them. */
  staffName?: string;
  /** The booking lies outside the plan (someone is off, the salon is closed) and needs moving. */
  misfit?: boolean;
  onOpen: () => void;
  /** Starts a new booking in the processing gap, where the staff member is free. */
  onGapOpen?: (start: number) => void;
}

/** A booking positioned in a time column. Draggable on devices with a mouse. */
export function BookingBlock({ booking, top, height, scale, compact, staffName, misfit, onOpen, onGapOpen }: BookingBlockProps) {
  const { state } = useStudio();
  const customer = findCustomer(state, booking.customerId);
  // What this visit's sheet offers, so "Show me" opens one that has the button it is heading for.
  const actions = useVisitActions()(booking).actions.join(" ");
  const service = findService(state, booking.serviceId);
  const gap = processingGap(booking, booking.start, booking.duration);
  const buffers = [
    { key: "before", minutes: booking.bufferBefore ?? 0, style: { bottom: "100%", height: (booking.bufferBefore ?? 0) * scale } },
    { key: "after", minutes: booking.bufferAfter ?? 0, style: { top: "100%", height: (booking.bufferAfter ?? 0) * scale } },
  ].filter((buffer) => buffer.minutes > 0);
  // Until the server answers, a booking a pending change made has only a provisional id: it cannot be opened or moved yet.
  const settled = accountRecordSettled("bookings", booking.id);
  const anna = booking.staffId === "anna";
  const serviceRef = useRef<HTMLSpanElement>(null);
  const serviceFits = useFitsInside(serviceRef, !!compact, service?.name);
  const previewed = usePreviewedId() === booking.id;
  // A block that leaves the screen (another day, a closed sheet) takes its preview with it.
  useEffect(() => () => hidePreview(booking.id), [booking.id]);
  const onDragStart = (event: DragEvent) => {
    hidePreview();
    event.dataTransfer.setData(DRAG_TYPE, booking.id);
    event.dataTransfer.effectAllowed = "move";
  };
  return (
    <div className="studio-calendar-booking absolute inset-x-1" style={{ top, height }}>
      <Button
        variant="tertiary"
        size="sm"
        align="start"
        draggable={settled}
        onDragStart={onDragStart}
        onClick={settled ? () => { hidePreview(); onOpen(); } : undefined}
        data-calendar-booking={booking.id}
        data-help-id="calendar.booking"
        data-help-state={actions}
        data-date={booking.date}
        data-start={booking.start}
        aria-describedby={previewed ? PREVIEW_ID : undefined}
        onPointerEnter={(event) => { if (event.pointerType === "mouse") previewBooking(booking.id, event.currentTarget, "pointer"); }}
        onPointerLeave={() => hidePreview(booking.id)}
        onFocus={(event) => { if (event.currentTarget.matches(":focus-visible")) previewBooking(booking.id, event.currentTarget, "focus"); }}
        onBlur={() => hidePreview(booking.id)}
        aria-disabled={!settled || undefined}
        className={cx(
          "h-full w-full !items-start overflow-hidden !rounded-xs border-l-2 !text-minimum !leading-tight",
          // The studio's button reset (`all: unset`) also turns off native dragging in Chromium.
          settled && "[-webkit-user-drag:element]",
          compact ? "!py-1 !pl-1 !pr-0.5 tracking-tight" : "!px-2",
          anna ? "border-staff-1 bg-staff-1-bg" : "border-staff-2 bg-staff-2-bg",
          misfit && "ring-2 ring-danger",
        )}
      >
        <span className="min-w-0">
          <span className={cx("block truncate font-semibold", !compact && "text-meta")}>{compact ? (booking.visitFor?.split(" ")[0] ?? customer?.firstName ?? "") : visitorName(booking, customer)}</span>
          <span className="block truncate text-text-secondary">
            {formatTime(booking.start)}
            {!compact && ` · ${service?.name}`}
          </span>
          {/* In the week the treatment shows only when the whole name fits the block, never as "Medic…". */}
          {compact && service && (
            <span ref={serviceRef} aria-hidden className={cx("mt-0.5 block overflow-hidden whitespace-nowrap text-text-secondary", !serviceFits && "invisible")}>{service.name}</span>
          )}
          {gap && <span className="sr-only">{t("calendar.processing", { from: formatTime(gap.start), to: formatTime(gap.end) })}</span>}
          {misfit && <Badge tone="warn" className="max-w-full">
            <span className="truncate">{t("calendar.needsMoving")}</span>
          </Badge>}
          {staffName && <span className="sr-only">{t("calendar.withStaff", { name: staffName })}</span>}
        </span>
      </Button>
      {gap && (
        <div
          aria-hidden={!onGapOpen || undefined}
          className={cx("absolute inset-x-0 bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--ui-border)_6px_7px)]", !onGapOpen && "pointer-events-none")}
          style={{ top: (gap.start - booking.start) * scale, height: (gap.end - gap.start) * scale }}
        >
          {onGapOpen && (
            <Button
              variant="tertiary"
              size="sm"
              className="h-full w-full cursor-copy !p-0"
              aria-label={t("calendar.bookInGap", { from: formatTime(gap.start), to: formatTime(gap.end) })}
              onClick={(event) => onGapOpen(minuteInGap(gap, event.clientY - event.currentTarget.getBoundingClientRect().top, scale))}
            />
          )}
        </div>
      )}
      {buffers.map(({ key, style }) => (
        <div key={key} aria-hidden className="pointer-events-none absolute inset-x-0 border-x border-dashed border-hairline bg-surface-2/60" style={style} />
      ))}
    </div>
  );
}

/**
 * Whether the element is shown whole inside its button: no wider than the line and not cut off at the bottom.
 * Measured again when the button changes size (window, docked panel, larger text).
 */
function useFitsInside(ref: RefObject<HTMLElement | null>, active: boolean, text: string | undefined) {
  const [fits, setFits] = useState(false);
  useEffect(() => {
    const element = ref.current;
    const box = element?.closest("button");
    if (!active || !element || !box) return;
    const measure = () => {
      const bottom = box.getBoundingClientRect().bottom - parseFloat(getComputedStyle(box).paddingBottom);
      setFits(element.scrollWidth <= element.clientWidth && element.getBoundingClientRect().bottom <= bottom + 0.5);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [ref, active, text]);
  return fits;
}
