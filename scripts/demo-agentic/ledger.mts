// The OAuth client ids the demo created, so the reset removes only what the demo made.
// Kept in the git-ignored .data/ folder of the checkout; ids only, no tokens or codes.
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/** Claude Code's published client metadata document; the runbook's live client. */
export const CLAUDE_CODE_CLIENT = "https://claude.ai/oauth/claude-code-client-metadata";
const ID = /^(?:[0-9a-f-]{36}|https:\/\/[\w.-]+\/[\w./-]{1,200})$/;
export const ledgerPath = (path = process.env.DEMO_AGENTIC_LEDGER) => resolve(path ?? ".data/demo-agentic-clients.json");

export function readLedger(path = ledgerPath()): string[] {
  if (!existsSync(path)) return [];
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string" && ID.test(id)) : [];
}
export function writeLedger(ids: string[], path = ledgerPath()) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, JSON.stringify([...new Set(ids)].filter(id => ID.test(id))) + "\n", { mode: 0o600 });
  chmodSync(path, 0o600);
}
export const recordClient = (id: string, path = ledgerPath()) => writeLedger([...readLedger(path), id], path);
