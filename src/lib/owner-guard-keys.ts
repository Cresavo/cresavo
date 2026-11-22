// Key prefixes of the owner guard rows (owner-guard-store.ts) in the shared "RateLimitBucket" table. Ordinary
// rate-limit keys are hex digests, so none can start with these. The shared store ignores them in its purge,
// its capacity count and its eviction, and the guard store keeps its own caps.
export const LOCK_KEYS = ["acct:", "strike:", "lock:"] as const;
export const MAILBOX_PREFIX = "mbx:";
export const GUARD_PREFIXES = [...LOCK_KEYS, MAILBOX_PREFIX] as const;
