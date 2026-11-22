import { normalizePhone } from "../booking/lookup";
import { MAX_IMPORT_ACTION_BYTES } from "@/lib/owner-actions/types";
import { isEmail } from "../connections/core";
import { fromKey, toKey } from "../data/dates";
import type { Customer, DateKey, StaffId } from "../data/types";
import type { MessageKey } from "../i18n";

// Customer import from a CSV file: parse, guess which column is which, and
// turn rows into customers with a status per row for the preview.
// Consent is not part of an import: `waitlist` (the only opt-in the customer
// model has) is always false, whatever a column says.

export type ImportField = "firstName" | "lastName" | "fullName" | "phone" | "email" | "birthday" | "note";

// Headers are matched lowercased, letters only. A national ID column
// (personnummer) is deliberately matched by nothing.
export const IMPORT_FIELDS: { field: ImportField; label: MessageKey; header: RegExp; exact?: RegExp }[] = [
  { field: "firstName", label: "import.field.firstName", header: /^(first ?name|given ?name|fname|f[oö]rnamn)$/ },
  { field: "lastName", label: "import.field.lastName", header: /^(last ?name|surname|family ?name|lname|efternamn)$/ },
  { field: "fullName", label: "import.field.fullName", header: /^(name|full ?name|customer|client|namn|kund|kundnamn|klient)$/ },
  { field: "phone", label: "import.field.phone", header: /phone|mobile|cell|tel|mobil/, exact: /^(phone|phone number|mobile|mobile phone|mobile number|cell|cell phone|telefon|telefonnummer|mobil|mobilnummer|tel|tel nr)$/ },
  { field: "email", label: "import.field.email", header: /mail|^e ?post/, exact: /^(e ?mail|e ?post|e ?postadress|e ?mailadress|e ?mail address|email address)$/ },
  { field: "birthday", label: "import.field.birthday", header: /birth|dob|f[oö]delse/ },
  { field: "note", label: "import.field.note", header: /note|comment|remark|anteckning|kommentar|anm[äa]rkning/ },
];

/** Column index per field; a missing field is not imported. */
export type Mapping = Partial<Record<ImportField, number>>;

export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export const FIELD_LIMIT: Record<ImportField, number> = { firstName: 60, lastName: 60, fullName: 120, phone: 30, email: 254, birthday: 20, note: 500 };

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

/** Splits CSV text (RFC 4180) into rows. `unclosedAt` is the line where a quote that never closes opened. */
function scanCsv(text: string): { rows: string[][]; unclosedAt?: number; badLine?: number } {
  const source = text.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let closed = false;
  let line = 1;
  let quoteLine = 1;
  let badLine: number | undefined;
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
    const breaks = char === "\n" || (char === "\r" && source[i + 1] !== "\n");
    if (breaks) line++;
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
        closed = true;
      } else cell += char;
    } else if (char === '"' && !cell.trim() && !closed) {
      quoted = true;
      quoteLine = line;
    } else if (char === delimiter) {
      endCell();
      closed = false;
    } else if (breaks) {
      endRow();
      closed = false;
    } else if (char !== "\r" && char !== "\n") {
      // Only spaces may follow a closing quote before the next separator.
      if (closed && char.trim()) badLine ??= line;
      cell += char;
    }
  }
  endRow();
  return { rows, unclosedAt: quoted ? quoteLine : undefined, badLine };
}

/** Splits CSV text (RFC 4180) into rows. Handles quoted cells with line breaks, doubled quotes, CR, LF or CRLF line ends, a BOM and comma, semicolon or tab separators. */
export const parseCsv = (text: string): string[][] => scanCsv(text).rows;

export type FileProblem = "tooBig" | "tooMany" | "empty" | "unclosedQuote" | "badQuote";

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

/** Parses an uploaded file's text, or says why it cannot be imported. `bytes` is the file's size. The header line is the first row. */
export function readImportFile(text: string, bytes: number): { rows: string[][] } | { problem: FileProblem; line?: number } {
  if (bytes > MAX_IMPORT_BYTES) return { problem: "tooBig" };
  const { rows, unclosedAt, badLine } = scanCsv(text);
  if (badLine) return { problem: "badQuote", line: badLine };
  if (unclosedAt) return { problem: "unclosedQuote", line: unclosedAt };
  if (rows.length < 2) return { problem: "empty" };
  return rows.length - 1 > MAX_IMPORT_ROWS ? { problem: "tooMany" } : { rows };
}

// Columns about consent or preferences are never an address or a number.
const CONSENT_HEADER = /samtycke|consent|preference|pref[eä]rens|opt ?in|opt ?out|marketing|marknadsf/;

/** Guesses the mapping from header names. Each column is used for one field at most; exact address headers win over loose ones. */
export function guessMapping(headers: string[]): Mapping {
  const mapping: Mapping = {};
  const used = new Set<number>();
  const names = headers.map((h) => h.toLowerCase().replace(/[^a-zåäö]+/g, " ").trim());
  for (const { field, header, exact } of IMPORT_FIELDS) {
    const find = (pattern: RegExp) => names.findIndex((name, i) => !used.has(i) && !CONSENT_HEADER.test(name) && pattern.test(name));
    const index = exact && find(exact) >= 0 ? find(exact) : find(header);
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

/** Undoes the apostrophe our own export puts before text that starts with = + - @ (see `defuseFormula`). */
export const normalizeEmail = (email: string | undefined) => (email ?? "").trim().toLowerCase();

const unprotect = (text: string) => (/^'[=+\-@]/.test(text) ? text.slice(1) : text);

/** One preview row per CSV row. Rows with a problem have no customer and are skipped on import. A phone number or e-mail already known (or earlier in the file) makes a duplicate. */
export function buildImportRows(
  rows: string[][],
  mapping: Mapping,
  existing: Pick<Customer, "phone" | "email">[],
  defaults: Pick<Customer, "since" | "preferredStaff">,
): ImportRow[] {
  const seenPhones = new Set(existing.map((c) => normalizePhone(c.phone)));
  const seenEmails = new Set(existing.map((c) => normalizeEmail(c.email)).filter(Boolean));
  return rows.map((row, index) => {
    const line = index + 2;
    const get = (field: ImportField) => (mapping[field] === undefined ? "" : unprotect((row[mapping[field]!] ?? "").trim()));
    if (IMPORT_FIELDS.some(({ field }) => get(field).length > FIELD_LIMIT[field])) return { line, problem: "tooLong" };
    const [fullFirst, ...fullRest] = get("fullName").split(/\s+/).filter(Boolean);
    const firstName = get("firstName") || fullFirst || "";
    const lastName = get("lastName") || (get("firstName") ? "" : fullRest.join(" "));
    if (!firstName) return { line, problem: "missingName" };
    if (firstName.length > FIELD_LIMIT.firstName || lastName.length > FIELD_LIMIT.lastName) return { line, problem: "tooLong" };
    const phone = get("phone");
    const digits = normalizePhone(phone);
    if (digits.length < 7) return { line, problem: "missingPhone" };
    const email = normalizeEmail(get("email"));
    if (email && !isEmail(email)) return { line, problem: "badEmail" };
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

const staffOk = (value: unknown, staff: readonly string[]): value is StaffId => typeof value === "string" && staff.includes(value);
const validDate = (value: unknown): value is DateKey => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && toKey(fromKey(value)) === value;

/**
 * The stored customer for one imported record, built from the allowed fields only with the same limits and
 * normalisation as the preview, or null when the record is not valid. Consent is never taken from the input.
 */
export function cleanImportedCustomer(raw: Partial<Record<keyof Omit<Customer, "id">, unknown>>, staff: readonly string[]): Omit<Customer, "id"> | null {
  const text = (value: unknown, max: number) => (value === undefined ? "" : typeof value === "string" && value.length <= max ? value.trim() : null);
  const firstName = text(raw.firstName, FIELD_LIMIT.firstName);
  const lastName = text(raw.lastName, FIELD_LIMIT.lastName);
  const phone = text(raw.phone, FIELD_LIMIT.phone);
  const email = text(raw.email, FIELD_LIMIT.email)?.toLowerCase();
  const note = text(raw.note, FIELD_LIMIT.note);
  if (!firstName || lastName === null || !phone || normalizePhone(phone).length < 7 || email === undefined || (email && !isEmail(email)) || note === null) return null;
  if (!staffOk(raw.preferredStaff, staff) || !validDate(raw.since)) return null;
  return {
    firstName,
    lastName,
    phone,
    email,
    category: "both",
    preferredStaff: raw.preferredStaff,
    since: raw.since,
    birthday: validDate(raw.birthday) && Number(raw.birthday.slice(0, 4)) >= 1900 ? raw.birthday : undefined,
    isRegular: false,
    note: note || undefined,
    tags: ["Imported"],
    waitlist: false,
  };
}

const bytesOf = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;
const importAction = (customers: Omit<Customer, "id">[]) => ({ type: "customers/import", customers });

/** Whether the import, sent as one action, is within the server's size limit for it. */
export const importFitsServer = (customers: Omit<Customer, "id">[]) => bytesOf(importAction(customers)) <= MAX_IMPORT_ACTION_BYTES;

/** About how many of these customers fit in one import, rounded down. */
export const maxRowsForServer = (customers: Omit<Customer, "id">[]) =>
  Math.floor(customers.length * (MAX_IMPORT_ACTION_BYTES / bytesOf(importAction(customers))) * 0.95);
