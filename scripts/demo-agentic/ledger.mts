// The OAuth client ids the demo created, so the reset removes only what the demo made.
// Kept in the git-ignored .data/ folder of the checkout; ids only, no tokens or codes.
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/** Claude Code's published client metadata document; the runbook's live client. */
export const CLAUDE_CODE_CLIENT = "https://claude.ai/oauth/claude-code-client-metadata";
const ID = /^(?:[0-9a-f-]{36}|https:\/\/[\w.-]+\/[\w./-]{1,200})$/;
export const ledgerPath = (path = process.env.DEMO_AGENTIC_LEDGER) => resolve(path ?? ".data/demo-agentic-clients.json");

type Ledger = { clients: string[]; since: string };
/** The demo's own client ids and when the last reset ran (the window for a shared published client). */
export function readLedger(path = ledgerPath()): Ledger {
  const empty = { clients: [], since: new Date().toISOString() };
  if (!existsSync(path)) return empty;
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<Ledger>;
  const clients = Array.isArray(parsed.clients) ? parsed.clients.filter((id): id is string => typeof id === "string" && ID.test(id)) : [];
  const since = typeof parsed.since === "string" && !Number.isNaN(Date.parse(parsed.since)) ? parsed.since : empty.since;
  return { clients, since };
}
export function writeLedger(ledger: Ledger, path = ledgerPath()) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, JSON.stringify({ clients: [...new Set(ledger.clients)].filter(id => ID.test(id)), since: ledger.since }) + "\n", { mode: 0o600 });
  chmodSync(path, 0o600);
}
export function recordClient(id: string, path = ledgerPath()) {
  const ledger = readLedger(path);
  writeLedger({ ...ledger, clients: [...ledger.clients, id] }, path);
}
