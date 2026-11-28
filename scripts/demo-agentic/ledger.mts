// The OAuth client ids the demo created, so the reset removes only what the demo made.
// Kept in the git-ignored .data/ folder of the checkout; ids only, no tokens or codes.
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const ID = /^[0-9a-f-]{36}$/;
export const ledgerPath = (path = process.env.DEMO_AGENTIC_LEDGER) => resolve(path ?? ".data/demo-agentic-clients.json");

/** The OAuth client ids the scripted assistant registered (dynamic registration, UUIDs only). */
export function readLedger(path = ledgerPath()): string[] {
  if (!existsSync(path)) return [];
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  const list = Array.isArray(parsed) ? parsed : (parsed as { clients?: unknown })?.clients;
  return Array.isArray(list) ? list.filter((id): id is string => typeof id === "string" && ID.test(id)) : [];
}
export function writeLedger(ids: string[], path = ledgerPath()) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, JSON.stringify([...new Set(ids)].filter(id => ID.test(id))) + "\n", { mode: 0o600 });
  chmodSync(path, 0o600);
}
export const recordClient = (id: string, path = ledgerPath()) => writeLedger([...readLedger(path), id], path);
