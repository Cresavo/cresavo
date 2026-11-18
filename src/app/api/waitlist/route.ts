import { NextResponse } from "next/server";
import { createRateLimiter, joinWaitlist, parseWaitlistInput, WAITLIST_PAGES, type WaitlistOutcome } from "@/concept/site/waitlist";

// The launch waiting list. Accepts JSON (the form's script) or a plain form post (no JavaScript),
// validates on the server and hands the address to the configured provider. With the default
// provider nothing is stored. The address is never logged.

const allowed = createRateLimiter();
const MAX_BODY = 2000;

async function read(request: Request): Promise<{ fields: unknown; form: boolean }> {
  const type = request.headers.get("content-type") ?? "";
  const text = (await request.text()).slice(0, MAX_BODY);
  if (type.includes("application/json")) {
    try {
      return { fields: JSON.parse(text), form: false };
    } catch {
      return { fields: null, form: false };
    }
  }
  return { fields: Object.fromEntries(new URLSearchParams(text)), form: true };
}

/** The first address in X-Forwarded-For (set by the platform's proxy), only used as a rate-limit key. */
const clientKey = (request: Request) => request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";

async function outcomeOf(request: Request, fields: unknown): Promise<WaitlistOutcome> {
  if (!allowed(clientKey(request))) return "limited";
  const input = parseWaitlistInput(fields);
  // A filled honeypot gets the same quiet answer as a real visitor, and nothing else happens.
  if (!input.ok) return input.reason === "bot" ? "not-open" : "invalid";
  try {
    return await joinWaitlist(input.entry);
  } catch {
    return "not-open";
  }
}

const STATUS: Record<WaitlistOutcome, number> = { "not-open": 200, added: 200, invalid: 400, limited: 429 };

export async function POST(request: Request) {
  const { fields, form } = await read(request);
  const outcome = await outcomeOf(request, fields);
  if (!form) return NextResponse.json({ outcome }, { status: STATUS[outcome], headers: { "Cache-Control": "no-store" } });
  const from = (fields as Record<string, string>).from;
  const back = new URL(WAITLIST_PAGES.find((page) => page === from) ?? "/", request.url);
  back.searchParams.set("waitlist", outcome);
  back.hash = "waitlist";
  return NextResponse.redirect(back, 303);
}
