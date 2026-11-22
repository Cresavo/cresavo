import { normalizePhone } from "../booking/lookup";
import { fromKey, toKey } from "../data/dates";
import type { Customer, DateKey } from "../data/types";
import type { MessageKey } from "../i18n";

// Customer import from a CSV file: parse, guess which column is which, and
// turn rows into customers with a status per row for the preview.
// Consent is not part of an import: `waitlist` (the only opt-in the customer
// model has) is always false, whatever a column says.

export type ImportField = "firstName" | "lastName" | "fullName" | "phone" | "email" | "birthday" | "note";

// Headers are matched lowercased, letters only. A national ID column
// (personnummer) is deliberately matched by nothing.
export const IMPORT_FIELDS: { field: ImportField; label: MessageKey; header: RegExp }[] = [
  { field: "firstName", label: "import.field.firstName", header: /^(first ?name|given ?name|fname|f[oö]rnamn)$/ },
  { field: "lastName", label: "import.field.lastName", header: /^(last ?name|surname|family ?name|lname|efternamn)$/ },
  { field: "fullName", label: "import.field.fullName", header: /^(name|full ?name|customer|client|namn|kund|kundnamn|klient)$/ },
  { field: "phone", label: "import.field.phone", header: /phone|mobile|cell|tel|mobil/ },
  { field: "email", label: "import.field.email", header: /mail|^e ?post/ },
  { field: "birthday", label: "import.field.birthday", header: /birth|dob|f[oö]delse/ },
  { field: "note", label: "import.field.note", header: /note|comment|remark|anteckning|kommentar|anm[äa]rkning/ },
];

/** Column index per field; a missing field is not imported. */
export type Mapping = Partial<Record<ImportField, number>>;

export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const FIELD_LIMIT: Record<ImportField, number> = { firstName: 60, lastName: 60, fullName: 120, phone: 30, email: 254, birthday: 20, note: 500 };

const DELIMITERS = [",", ";", "\t"];

/** The separator used most often in the header line, not counting any inside quotes. */
function detectDelimiter(source: string): string {
  const counts = new Map(DELIMITERS.map((d) => [d, 0]));
  let quoted = false;
  for (const char of source) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === "\n" || char === "\r")) break;
    else if (!quoted && counts.has(char)) counts.set(char, counts.get(char)! + 1);
  }
  return DELIMITERS.reduce((best, d) => (counts.get(d)! > counts.get(best)! ? d : best), ",");
}

/** Splits CSV text (RFC 4180) into rows. Handles quoted cells with line breaks, doubled quotes, CRLF, a BOM and comma, semicolon or tab separators. */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, "");
  const delimiter = detectDelimiter(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const endCell = () => {
    row.push(cell.trim());
    cell = "";
  };
  const endRow = () => {
    endCell();
    if (row.some(Boolean)) rows.push(row);
    row = [];
  };
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) endCell();
    else if (char === "\n") endRow();
    else if (char !== "\r") cell += char;
  }
  endRow();
  return rows;
}

export type FileProblem = "tooBig" | "tooMany" | "empty";

/**
 * The text of an uploaded file. Exports from older Swedish systems and Excel are often Windows-1252 rather
 * than UTF-8, which would turn å, ä and ö into garbage, so bytes that are not valid UTF-8 are read as Windows-1252.
 */
export function decodeImportFile(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** Parses an uploaded file's text, or says why it cannot be imported. The header line is the first row. */
export function readImportFile(text: string): { rows: string[][] } | { problem: FileProblem } {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) return { problem: "tooBig" };
  const rows = parseCsv(text);
  if (rows.length < 2) return { problem: "empty" };
  return rows.length - 1 > MAX_IMPORT_ROWS ? { problem: "tooMany" } : { rows };
}

/** Guesses the mapping from header names. Each column is used for one field at most. */
export function guessMapping(headers: string[]): Mapping {
  const mapping: Mapping = {};
  const used = new Set<number>();
  for (const { field, header } of IMPORT_FIELDS) {
    const index = headers.findIndex((h, i) => !used.has(i) && header.test(h.toLowerCase().replace(/[^a-zåäö]+/g, " ").trim()));
    if (index >= 0) {
      mapping[field] = index;
      used.add(index);
    }
  }
  return mapping;
}

/** "1984-03-09", "09/03/1984", "9.3.1984" or "9-3-1984" (day first) as a date, or undefined. */
export function parseBirthday(text: string): DateKey | undefined {
  const match = text.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$|^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!match) return undefined;
  const [year, month, day] = match[1] ? [match[1], match[2], match[3]] : [match[6], match[5], match[4]];
  const key = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  return Number(year) >= 1900 && toKey(fromKey(key)) === key ? key : undefined;
}

export type ImportProblem = "missingName" | "missingPhone" | "badEmail" | "tooLong" | "duplicate";

export interface ImportRow {
  /** Line number in the file, counting the header as line 1. */
  line: number;
  customer?: Omit<Customer, "id">;
  problem?: ImportProblem;
  birthdayIgnored?: boolean;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** One preview row per CSV row. Rows with a problem have no customer and are skipped on import. A phone number or e-mail already known (or earlier in the file) makes a duplicate. */
export function buildImportRows(
  rows: string[][],
  mapping: Mapping,
  existing: Pick<Customer, "phone" | "email">[],
  defaults: Pick<Customer, "since" | "preferredStaff">,
): ImportRow[] {
  const seenPhones = new Set(existing.map((c) => normalizePhone(c.phone)));
  const seenEmails = new Set(existing.map((c) => c.email.toLowerCase()).filter(Boolean));
  return rows.map((row, index) => {
    const line = index + 2;
    const get = (field: ImportField) => (mapping[field] === undefined ? "" : (row[mapping[field]!] ?? "").trim());
    if (IMPORT_FIELDS.some(({ field }) => get(field).length > FIELD_LIMIT[field])) return { line, problem: "tooLong" };
    const [fullFirst, ...fullRest] = get("fullName").split(/\s+/).filter(Boolean);
    const firstName = get("firstName") || fullFirst || "";
    const lastName = get("lastName") || (get("firstName") ? "" : fullRest.join(" "));
    if (!firstName) return { line, problem: "missingName" };
    const phone = get("phone");
    const digits = normalizePhone(phone);
    if (digits.length < 7) return { line, problem: "missingPhone" };
    const email = get("email").toLowerCase();
    if (email && !EMAIL.test(email)) return { line, problem: "badEmail" };
    if (seenPhones.has(digits) || (email && seenEmails.has(email))) return { line, problem: "duplicate" };
    seenPhones.add(digits);
    if (email) seenEmails.add(email);
    const birthdayText = get("birthday");
    const birthday = parseBirthday(birthdayText);
    return {
      line,
      birthdayIgnored: !!birthdayText && !birthday,
      customer: {
        firstName,
        lastName,
        phone,
        email,
        category: "both",
        preferredStaff: defaults.preferredStaff,
        since: defaults.since,
        birthday,
        isRegular: false,
        note: get("note") || undefined,
        tags: ["Imported"],
        waitlist: false,
      },
    };
  });
}

export interface ImportSummary {
  ready: number;
  duplicates: number;
  errors: number;
}

export function summarizeImport(rows: ImportRow[]): ImportSummary {
  const duplicates = rows.filter((r) => r.problem === "duplicate").length;
  const ready = rows.filter((r) => r.customer).length;
  return { ready, duplicates, errors: rows.length - ready - duplicates };
}
