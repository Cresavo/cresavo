import { formatTime } from "../../i18n/format";
import type { DemoState } from "../../data/types";
import { findService } from "../../selectors";

// Plain exports of the demo data. Column names stay in English on purpose:
// they are a data format, not UI text.

/**
 * Stops a spreadsheet from running text as a formula: text that starts with = + - @ (or tab or CR) gets an
 * apostrophe, which the customer import removes again. Known, accepted limitation: an e-mail address that
 * really starts with one of those characters (for example "+desk@example.test") cannot be told from a
 * protected one, so it is imported without the apostrophe either way. Such addresses are very rare.
 * Use it on every text column, ids, dates and phone numbers included; numbers are written as they are.
 */
export function defuseFormula(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

const protectText = (row: (string | number | undefined)[]) => row.map((cell) => (typeof cell === "string" ? defuseFormula(cell) : cell));

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
    ...state.customers.map((c) => protectText([c.id, c.firstName, c.lastName, c.phone, c.email, c.since, c.tags.join("; "), c.note])),
  ]);
}

export function bookingsCsv(state: DemoState): string {
  return toCsv([
    ["id", "date", "time", "minutes", "customer_id", "service", "staff", `price_${state.localization.currency.toLowerCase()}`, "status"],
    ...state.bookings.map((b) => protectText([
      b.id,
      b.date,
      formatTime(b.start),
      b.duration,
      b.customerId,
      findService(state, b.serviceId)?.name,
      b.staffId,
      b.price,
      b.status,
    ])),
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
