"use client";

import { formatTime } from "../../i18n/format";
import type { DragEvent } from "react";
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
  /** The booking lies outside the plan (someone is off, the salon is closed) and needs moving. */
  misfit?: boolean;
  onOpen: () => void;
}

/** A booking positioned in a time column. Draggable on devices with a mouse. */
export function BookingBlock({ booking, top, height, compact, misfit, onOpen }: BookingBlockProps) {
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
        "absolute inset-x-1 flex flex-col justify-start overflow-hidden rounded-sm border-l-[3px] px-2 py-1 text-left text-xs leading-tight transition-colors hover:border-l-[5px]",
        anna ? "border-staff-1 bg-staff-1-bg" : "border-staff-2 bg-staff-2-bg",
        misfit && "ring-2 ring-danger",
      )}
    >
      <span className="block truncate font-semibold">{customer ? (compact ? customer.firstName : fullName(customer)) : ""}</span>
      {height > 34 && (
        <span className="block truncate text-text-secondary">
          {formatTime(booking.start)}
          {!compact && ` · ${service?.name}`}
        </span>
      )}
    </button>
  );
}
