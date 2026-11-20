export const IDEMPOTENCY_KEY_MAX = 200;
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/** The authenticated client ID, site key, or the reserved studio caller. */
export function scopedIdempotencyKey(caller: string, key: string): string {
  // The caller cannot contain the separator. Opaque keys may contain colons.
  if (typeof caller !== "string" || !caller || /[^A-Za-z0-9_-]/.test(caller) ||
      typeof key !== "string" || !key || /[^!-~]/.test(key) || caller.length + 1 + key.length > IDEMPOTENCY_KEY_MAX) {
    throw new RangeError("Invalid scoped idempotency key");
  }
  return `${caller}:${key}`;
}
