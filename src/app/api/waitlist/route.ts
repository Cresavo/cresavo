import { NextResponse } from "next/server";
import { createRateLimiter, joinWaitlist, parseWaitlistInput, WAITLIST_PAGES, type WaitlistOutcome } from "@/concept/site/waitlist";
import { readCapped, waitlistClientKey } from "@/concept/site/waitlist-server";

// The launch waiting list. Accepts JSON (the form's script) or a plain form post (no JavaScript),
// validates on the server and hands the address to the configured provider. With the default
// provider nothing is stored. The address is never logged.
//
// The limit is counted before the body is read, against the verified client address. It is kept
// in this process only (best effort on serverless: a cold start begins afresh), so a deployment
// that opens a real provider should also limit the route at the platform's firewall.

const allowed = createRateLimiter();
/** Bytes, not characters: a form with one address and a business kind is far below this. */
const MAX_BODY = 2000;

function parse(type: string, text: string): { fields: unknown; form: boolean } {
  if (type.includes("application/json")) {
    try {
      return { fields: JSON.parse(text), form: false };
    } catch {
      return { fields: null, form: false };
    }
  }
  return { fields: Object.fromEntries(new URLSearchParams(text)), form: true };
}

async function outcomeOf(fields: unknown): Promise<WaitlistOutcome> {
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
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  const form = !type.includes("application/json");
  const answer = (outcome: WaitlistOutcome, from?: unknown, status = STATUS[outcome]) => {
    if (!form || status === 413) return NextResponse.json({ outcome }, { status, headers: NO_STORE });
    const back = new URL(WAITLIST_PAGES.find((page) => page === from) ?? "/", request.url);
    back.searchParams.set("waitlist", outcome);
    back.hash = "waitlist";
    return NextResponse.redirect(back, 303);
  };
  if (!allowed(waitlistClientKey(request.headers))) {
    await request.body?.cancel().catch(() => undefined);
    return answer("limited");
  }
  const text = await readCapped(request, MAX_BODY);
  if (text === "too-large") return answer("invalid", undefined, 413);
  const { fields } = parse(type, text);
  return answer(await outcomeOf(fields), (fields as Record<string, unknown> | null)?.from);
}
