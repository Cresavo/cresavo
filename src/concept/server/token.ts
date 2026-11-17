import { createHash, timingSafeEqual } from "node:crypto";

// The concept's MCP endpoint takes one shared demo bearer token from
// CONCEPT_MCP_TOKEN. Outside production a documented development token is
// used when it is unset, so `npm run dev` works out of the box; production
// refuses every call until the variable is set. Not owner authentication:
// that belongs to the pilot gate (docs/QUALITY_SECURITY.md).

export const DEV_TOKEN = "flerdo-demo-token";
const MIN_LENGTH = 16;

type Env = Record<string, string | undefined>;

export type TokenSource = "env" | "dev-default" | "missing";

/** Where the expected token comes from. "missing" means the endpoint is closed. */
export function tokenSource(env: Env = process.env): TokenSource {
  const configured = env.CONCEPT_MCP_TOKEN?.trim();
  if (configured && configured.length >= MIN_LENGTH) return "env";
  return env.NODE_ENV === "production" ? "missing" : "dev-default";
}

function expectedToken(env: Env): string | null {
  const source = tokenSource(env);
  if (source === "missing") return null;
  return source === "env" ? env.CONCEPT_MCP_TOKEN!.trim() : DEV_TOKEN;
}

const digest = (value: string) => createHash("sha256").update(value).digest();

export type BearerCheck = { ok: true; caller: string } | { ok: false; status: 401 | 503 };

/** Checks `Authorization: Bearer <token>` in constant time. `caller` is a short hash for rate limits and idempotency, never the token. */
export function checkBearer(headers: Headers, env: Env = process.env): BearerCheck {
  const expected = expectedToken(env);
  if (!expected) return { ok: false, status: 503 };
  const match = /^Bearer\s+(\S+)$/i.exec(headers.get("authorization") ?? "");
  if (!match || !timingSafeEqual(digest(match[1]), digest(expected))) return { ok: false, status: 401 };
  return { ok: true, caller: digest(match[1]).toString("hex").slice(0, 16) };
}
