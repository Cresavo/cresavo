import { formatTime } from "../../i18n/format";
import type { DemoState } from "../../data/types";
import { findService } from "../../selectors";

// Plain exports of the demo data. Column names stay in English on purpose:
// they are a data format, not UI text.

/**
 * Stops a spreadsheet from running free text as a formula: text that starts with = + - @ (or tab or CR) gets
 * an apostrophe, which the customer import removes again. Use it on free-text columns only; phone numbers,
 * dates and amounts are written as the values they are.
 */
export function defuseFormula(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

const safe = (text: string | undefined) => (text === undefined ? undefined : defuseFormula(text));

function csvCell(value: string | number | undefined): string {
  const text = value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: (string | number | undefined)[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function customersCsv(state: DemoState): string {
  return toCsv([
    ["id", "first_name", "last_name", "phone", "email", "customer_since", "tags", "note"],
    ...state.customers.map((c) => [c.id, safe(c.firstName), safe(c.lastName), c.phone, safe(c.email), c.since, safe(c.tags.join("; ")), safe(c.note)]),
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
      safe(findService(state, b.serviceId)?.name),
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
