import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CostEntry } from "./cost-log";
import type { Provider } from "./router";

export const DEMO_BUSINESS = "salong-eko";
export interface EncryptedKey { provider: Provider; last4: string; iv: string; tag: string; ciphertext: string }
export interface BusinessAiData {
  key?: EncryptedKey;
  tiers: Record<string, "fast" | "smart">;
  costs: CostEntry[];
}
// Tests use isolated memory unless explicitly exercising disk persistence.
const memory = new Map<string, BusinessAiData>();
function directory() { return process.env.CONCEPT_AI_STORE_DIR || (process.env.VITEST ? null : join(process.cwd(), ".data", "concept-ai")); }
function file(business: string) {
  if (!/^[a-z0-9-]{1,80}$/.test(business)) throw new Error("Invalid business");
  const dir = directory();
  return dir ? join(dir, `${business}.json`) : null;
}
export function readBusinessAi(business = DEMO_BUSINESS): BusinessAiData {
  const path = file(business);
  if (!path) return structuredClone(memory.get(business) ?? { tiers: {}, costs: [] });
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { tiers: {}, costs: [] };
    throw new Error("AI demo store unavailable");
  }
}
/** Synchronous read/modify/atomic rename: local single-process demo, no database. */
export function updateBusinessAi(business: string, update: (data: BusinessAiData) => void) {
  const data = readBusinessAi(business);
  update(data);
  const path = file(business);
  if (!path) { memory.set(business, structuredClone(data)); return; }
  mkdirSync(directory()!, { recursive: true, mode: 0o700 });
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(data), { mode: 0o600 });
  renameSync(temp, path);
}
