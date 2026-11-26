/** One in-flight logo decode for salon setup, so creating the salon can wait for it. */

let ticket = 0;
let pending = false;
const waiters = new Set<() => void>();
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function settle() {
  pending = false;
  for (const waiter of waiters) waiter();
  waiters.clear();
  notify();
}

/** True while a chosen logo is still being prepared. */
export function logoBusy() {
  return pending;
}

export function subscribeLogo(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Starts a new decode and cancels any earlier one. Returns a ticket for this pick. */
export function beginLogo() {
  const id = ++ticket;
  pending = true;
  notify();
  return id;
}

export function isLatestLogo(id: number) {
  return id === ticket;
}

/** Ends this pick if it is still the latest one. */
export function finishLogo(id: number) {
  if (id === ticket && pending) settle();
}

/** Drops any in-flight logo, for example when the owner leaves the look step. */
export function cancelLogo() {
  if (!pending && ticket === 0) return;
  ticket += 1;
  if (pending) settle();
}

/** Resolves when the current decode finishes or is dropped. */
export function waitForLogo() {
  if (!pending) return Promise.resolve();
  return new Promise<void>(resolve => { waiters.add(resolve); });
}
