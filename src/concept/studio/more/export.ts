import { formatTime } from "../../i18n/format";
import type { DemoState } from "../../data/types";
import { findService } from "../../selectors";

// Plain exports of the demo data. Column names stay in English on purpose:
// they are a data format, not UI text.

/** Stops a spreadsheet from running free text as a formula: a leading = + - @ (or tab/CR) gets an apostrophe. Plain numbers and phone numbers stay as they are. */
export function defuseFormula(text: string): string {
  return /^[=+\-@\t\r]/.test(text) && !/^[+-]?[\d\s().-]+$/.test(text) ? `'${text}` : text;
}

function csvCell(value: string | number | undefined): string {
  const text = value === undefined ? "" : typeof value === "number" ? String(value) : defuseFormula(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: (string | number | undefined)[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function customersCsv(state: DemoState): string {
  return toCsv([
    ["id", "first_name", "last_name", "phone", "email", "customer_since", "tags", "note"],
    ...state.customers.map((c) => [c.id, c.firstName, c.lastName, c.phone, c.email, c.since, c.tags.join("; "), c.note]),
  ]);
}

export function bookingsCsv(state: DemoState): string {
  return toCsv([
    ["id", "date", "time", "minutes", "customer_id", "service", "staff", `price_${state.localization.currency.toLowerCase()}`, "status"],
    ...state.bookings.map((b) => [
      b.id,
      b.date,
      formatTime(b.start),
      b.duration,
      b.customerId,
      findService(state, b.serviceId)?.name,
      b.staffId,
      b.price,
      b.status,
    ]),
  ]);
}

/** Starts a browser download of a text file. */
export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
