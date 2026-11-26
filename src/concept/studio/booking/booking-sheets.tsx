"use client";

import { BookingSheet } from "./booking-sheet";
import { NewBookingSheet, type NewBookingPreset } from "./new-booking-sheet";
import { PhoneModeSheet } from "./phone-mode-sheet";

export type OpenSheet =
  | { kind: "booking"; id: string; mode?: "details" | "move" }
  | { kind: "new"; preset: NewBookingPreset }
  | { kind: "phone" }
  | null;

/**
 * Renders whichever booking sheet a page has open. Pages keep `OpenSheet` in state. `dock`: on a wide screen a
 * booking's details open in a panel beside the page instead of over it (the calendar).
 */
export function BookingSheets({ sheet, onChange, dock }: { sheet: OpenSheet; onChange: (sheet: OpenSheet) => void; dock?: boolean }) {
  const close = () => onChange(null);
  if (!sheet) return null;
  if (sheet.kind === "booking") return <BookingSheet key={sheet.id} bookingId={sheet.id} initialMode={sheet.mode} onClose={close} dock={dock} />;
  if (sheet.kind === "new") return <NewBookingSheet preset={sheet.preset} onClose={close} />;
  return (
    <PhoneModeSheet
      onClose={close}
      onBook={(preset) => onChange({ kind: "new", preset })}
      onMove={(id) => onChange({ kind: "booking", id, mode: "move" })}
    />
  );
}
