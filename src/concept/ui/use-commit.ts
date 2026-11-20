"use client";

import { useState } from "react";

/**
 * Runs one commit at a time: a call while one is in flight is ignored and
 * resolves undefined. For buttons where a double click would create two
 * records (a booking, a payment, a gift card sale).
 */
export function pendingGate(onChange: (pending: boolean) => void = () => undefined) {
  let pending = false;
  return async function run<T>(commit: () => Promise<T>): Promise<T | undefined> {
    if (pending) return undefined;
    pending = true;
    onChange(true);
    try {
      return await commit();
    } finally {
      pending = false;
      onChange(false);
    }
  };
}

/** `[run, pending]`: disable the button while `pending`; `run` ignores clicks until the commit settles. */
export function useCommit() {
  const [pending, setPending] = useState(false);
  const [run] = useState(() => pendingGate(setPending));
  return [run, pending] as const;
}
