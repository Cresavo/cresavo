// A fixed-window limit per caller, in bounded process memory.

export interface Limit {
  max: number;
  windowMs: number;
}

const MAX_KEYS = 1000;

export type LimitResult = { ok: true } | { ok: false; retryAfter: number };

export function createRateLimiter({ max, windowMs }: Limit) {
  const windows = new Map<string, { count: number; until: number }>();
  return function take(key: string, now = Date.now()): LimitResult {
    for (const [k, w] of windows) if (w.until <= now) windows.delete(k);
    const current = windows.get(key) ?? { count: 0, until: now + windowMs };
    if (current.count >= max) return { ok: false, retryAfter: Math.max(1, Math.ceil((current.until - now) / 1000)) };
    if (!windows.has(key) && windows.size >= MAX_KEYS) return { ok: false, retryAfter: 1 };
    windows.set(key, { ...current, count: current.count + 1 });
    return { ok: true };
  };
}
