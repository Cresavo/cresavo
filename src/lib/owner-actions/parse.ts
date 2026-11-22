import type { DemoAction } from "@/concept/actions";
import { OWNER_ACTION_SCHEMAS } from "./schemas";
import { actionByteLimit, OWNER_ACTION_TYPES, type OwnerActionType } from "./types";

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_DEPTH = 12;

function isOwnerActionType(value: unknown): value is OwnerActionType {
  return typeof value === "string" && (OWNER_ACTION_TYPES as readonly string[]).includes(value);
}

/** Whether a key that could reach an object's prototype appears anywhere in the value, or the value nests too deeply. */
function hasForbiddenKey(value: unknown, depth = 0): boolean {
  if (!value || typeof value !== "object") return false;
  if (depth > MAX_DEPTH) return true;
  if (Array.isArray(value)) return value.some((item) => hasForbiddenKey(item, depth + 1));
  return Object.keys(value).some((key) => FORBIDDEN_KEYS.has(key) || hasForbiddenKey((value as Record<string, unknown>)[key], depth + 1));
}

/** Whether a value of ordinary depth serialises to more than the cap for its action type. Too-deep values are not "large": they are invalid. */
export function actionTooLarge(value: unknown): boolean {
  const type = value && typeof value === "object" ? (value as { type?: unknown }).type : undefined;
  return !hasForbiddenKey(value) && Buffer.byteLength(JSON.stringify(value) ?? "") > actionByteLimit(type);
}

/** The action as its schema parses it, or null. The nesting depth is checked before the size, so a deep value never reaches `JSON.stringify`. Unknown fields, wrong types and out-of-range values are refused. */
export function parseOwnerAction(value: unknown): DemoAction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const type = (value as { type?: unknown }).type;
  if (!isOwnerActionType(type) || hasForbiddenKey(value)) return null;
  if (actionTooLarge(value)) return null;
  const parsed = OWNER_ACTION_SCHEMAS[type].safeParse(value);
  return parsed.success ? parsed.data as DemoAction : null;
}
