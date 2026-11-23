// Structured logging: one JSON line per event. An event is a fixed code, never
// a sentence. The only way to add detail is the allowlist below, and every
// allowed field has a strict shape, so free text, addresses, phone numbers,
// names, tokens, cookies and bodies cannot get into a line. A value that does
// not fit its shape is dropped, not logged.

export type LogLevel = "info" | "warn" | "error";

const NAME = /^[a-z][a-z0-9_-]{0,39}$/;
const FIELDS = {
  requestId: /^[A-Za-z0-9_-]{8,64}$/,
  /** A route pattern such as "/api/owner/login" or "/api/public/salons/[slug]", never a real URL. */
  route: /^\/[A-Za-z0-9/_.[\]-]{0,119}$/,
  method: /^[A-Z]{3,7}$/,
  provider: NAME,
  reason: NAME,
  code: NAME,
  task: NAME,
  tool: NAME,
  /** Class name of an error, never its message. */
  errorName: /^[A-Za-z][A-Za-z0-9]{0,39}$/,
  status: "int",
  durationMs: "int",
} as const;
type FieldName = keyof typeof FIELDS;
export type LogFields = { [K in FieldName]?: (typeof FIELDS)[K] extends "int" ? number : string };

const EVENT = /^[A-Z][A-Z0-9_]{2,63}$/;
// A long run of digits could be a phone number or an id.
const LONG_DIGITS = /\d{6,}/;

function clean(name: FieldName, value: unknown): string | number | undefined {
  const shape = FIELDS[name];
  if (shape === "int") return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 1e9 ? value : undefined;
  return typeof value === "string" && shape.test(value) && !LONG_DIGITS.test(value) ? value : undefined;
}

export function formatLog(level: LogLevel, event: string, fields: LogFields = {}, now = new Date()): string {
  const line: Record<string, string | number> = { level, event: EVENT.test(event) ? event : "INVALID_EVENT", time: now.toISOString() };
  for (const name of Object.keys(FIELDS) as FieldName[]) {
    const value = clean(name, (fields as Record<string, unknown>)[name]);
    if (value !== undefined) line[name] = value;
  }
  return JSON.stringify(line);
}

// Warnings and errors stay on stderr: the stdio MCP server owns stdout.
export const log = {
  info: (event: string, fields?: LogFields) => console.info(formatLog("info", event, fields)),
  warn: (event: string, fields?: LogFields) => console.warn(formatLog("warn", event, fields)),
  error: (event: string, fields?: LogFields) => console.error(formatLog("error", event, fields)),
};
