import { normalizePhone } from "../booking/lookup";
import { fromKey, toKey } from "../data/dates";
import type { Customer, DateKey } from "../data/types";
import type { MessageKey } from "../i18n";

// Customer import from a CSV file: parse, guess which column is which, and
// turn rows into customers with a status per row for the preview.

export type ImportField = "firstName" | "lastName" | "fullName" | "phone" | "email" | "birthday" | "note";

export const IMPORT_FIELDS: { field: ImportField; label: MessageKey; header: RegExp }[] = [
  { field: "firstName", label: "import.field.firstName", header: /^(first ?name|given ?name|fname|f[oö]rnamn)$/ },
  { field: "lastName", label: "import.field.lastName", header: /^(last ?name|surname|family ?name|lname|efternamn)$/ },
  { field: "fullName", label: "import.field.fullName", header: /^(name|full ?name|customer|namn|kund)$/ },
  { field: "phone", label: "import.field.phone", header: /phone|mobile|cell|tel|mobil/ },
  { field: "email", label: "import.field.email", header: /mail/ },
  { field: "birthday", label: "import.field.birthday", header: /birth|dob|f[oö]delse/ },
  { field: "note", label: "import.field.note", header: /note|comment|remark|anteckning/ },
];

/** Column index per field; a missing field is not imported. */
export type Mapping = Partial<Record<ImportField, number>>;

const DELIMITERS = [",", ";", "\t"];

/** Splits CSV text into rows. Handles quoted cells, doubled quotes, CRLF, a BOM and comma, semicolon or tab separators. */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, "");
  const firstLine = source.split(/\r?\n/, 1)[0];
  const delimiter = DELIMITERS.map((d) => ({ d, n: firstLine.split(d).length })).sort((a, b) => b.n - a.n)[0].d;
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

export type ImportProblem = "missingName" | "missingPhone" | "duplicate";

export interface ImportRow {
  /** Line number in the file, counting the header as line 1. */
  line: number;
  customer?: Omit<Customer, "id">;
  problem?: ImportProblem;
  birthdayIgnored?: boolean;
}

/** One preview row per CSV row. Rows with a problem have no customer and are skipped on import. */
export function buildImportRows(
  rows: string[][],
  mapping: Mapping,
  existing: Pick<Customer, "phone">[],
  defaults: Pick<Customer, "since" | "preferredStaff">,
): ImportRow[] {
  const seen = new Set(existing.map((c) => normalizePhone(c.phone)));
  return rows.map((row, index) => {
    const line = index + 2;
    const get = (field: ImportField) => (mapping[field] === undefined ? "" : (row[mapping[field]!] ?? "").trim());
    const [fullFirst, ...fullRest] = get("fullName").split(/\s+/).filter(Boolean);
    const firstName = get("firstName") || fullFirst || "";
    const lastName = get("lastName") || (get("firstName") ? "" : fullRest.join(" "));
    if (!firstName) return { line, problem: "missingName" };
    const phone = get("phone");
    const digits = normalizePhone(phone);
    if (digits.length < 7) return { line, problem: "missingPhone" };
    if (seen.has(digits)) return { line, problem: "duplicate" };
    seen.add(digits);
    const birthdayText = get("birthday");
    const birthday = parseBirthday(birthdayText);
    return {
      line,
      birthdayIgnored: !!birthdayText && !birthday,
      customer: {
        firstName,
        lastName,
        phone,
        email: get("email"),
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
