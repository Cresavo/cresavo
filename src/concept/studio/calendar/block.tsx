"use client";

import type { DragEvent } from "react";
import { formatTime } from "../../data/dates";
import type { Booking } from "../../data/types";
import { findCustomer, findService, fullName } from "../../selectors";
import { cx } from "../../ui/cx";
import { useStudio } from "../use-studio";

export const DRAG_TYPE = "application/x-eko-booking";

interface BookingBlockProps {
  booking: Booking;
  top: number;
  height: number;
  compact?: boolean;
  onOpen: () => void;
}

/** A booking positioned in a time column. Draggable on devices with a mouse. */
export function BookingBlock({ booking, top, height, compact, onOpen }: BookingBlockProps) {
  const { state } = useStudio();
  const customer = findCustomer(state, booking.customerId);
  const service = findService(state, booking.serviceId);
  const anna = booking.staffId === "anna";
  const onDragStart = (event: DragEvent) => {
    event.dataTransfer.setData(DRAG_TYPE, booking.id);
    event.dataTransfer.effectAllowed = "move";
  };
  return (
    <button
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
      style={{ top, height }}
      className={cx(
        "absolute inset-x-1 flex flex-col justify-start overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-left text-xs leading-tight transition-shadow hover:shadow-card",
        anna ? "border-eko-anna bg-eko-anna-soft" : "border-eko-erik bg-eko-erik-soft",
      )}
    >
      <span className="block truncate font-semibold">{customer ? (compact ? customer.firstName : fullName(customer)) : ""}</span>
      {height > 34 && (
        <span className="block truncate text-eko-muted">
          {formatTime(booking.start)}
          {!compact && ` · ${service?.name}`}
        </span>
      )}
    </button>
  );
}
