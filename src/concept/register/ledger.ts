import { useSyncExternalStore } from "react";
import { demoPayments } from "../connections/demo";
import type { RegisterPayment, RegisterPort, RegisterRecord } from "../connections/ports/register";
import { emptyRegisterBook, type RegisterBook } from "../connections/simulated/register";
import type { Target } from "../store/commit";
import { createRegister, demoRegisterAllowed, unavailableRegister } from "./factory";

// The demo register's book in the browser, one per salon lifetime: a new
// sample day or a replaced trial salon starts with an empty register. The
// book holds only invented sales of the browser's own demo salon.

const PREFIX = "cresavo-demo-register";
const NO_RECEIPTS: RegisterRecord[] = [];
const keyOf = (target: Target) => `${PREFIX}-${target.workspace}-${target.epoch}`;
const books = new Map<string, RegisterBook>();
const listeners = new Set<() => void>();

function storage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function read(key: string): RegisterBook {
  const cached = books.get(key);
  if (cached) return cached;
  let book = emptyRegisterBook();
  try {
    const raw = storage()?.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as Partial<RegisterBook>) : undefined;
    if (parsed && Array.isArray(parsed.sales) && Array.isArray(parsed.payments) && Array.isArray(parsed.records) && parsed.keys && typeof parsed.keys === "object") {
      book = parsed as RegisterBook;
    }
  } catch {
    // An unreadable book starts empty, like a new salon.
  }
  books.set(key, book);
  return book;
}

function write(target: Target, book: RegisterBook) {
  const key = keyOf(target);
  books.set(key, book);
  const store = storage();
  try {
    store?.setItem(key, JSON.stringify(book));
    // Earlier lifetimes of this workspace's salon are gone; so are their registers.
    const stale = `${PREFIX}-${target.workspace}-`;
    for (let i = (store?.length ?? 0) - 1; i >= 0; i--) {
      const other = store?.key(i);
      if (other?.startsWith(stale) && other !== key) store?.removeItem(other);
    }
  } catch {
    // Full or blocked storage: the sale stays in this tab.
  }
  listeners.forEach((listener) => listener());
}

/** The register for the salon a studio view shows. Null target (a salon the store never read): no register. */
export function registerFor(target: Target | null | undefined): RegisterPort {
  if (!target) return unavailableRegister;
  return createRegister({ workspace: target.workspace, payments: demoPayments }, read(keyOf(target)), (book) => write(target, book));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (!event.key?.startsWith(PREFIX)) return;
    books.delete(event.key);
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The payment a visit is waiting for (started, not confirmed yet), live. It survives a reload, so the register can pick it up again. */
export function usePendingPayment(target: Target | null | undefined, reference: string): RegisterPayment | undefined {
  const book = useSyncExternalStore(
    subscribe,
    () => (target && demoRegisterAllowed({ workspace: target.workspace, payments: demoPayments }) ? read(keyOf(target)) : undefined),
    () => undefined,
  );
  const sale = book?.sales.find((s) => s.reference === reference && s.state === "awaiting");
  return sale && book?.payments.find((p) => p.saleId === sale.id && p.state === "pending");
}

/** Every receipt in the salon's register, live. */
export function useRegisterReceipts(target: Target | null | undefined): RegisterRecord[] {
  return useSyncExternalStore(
    subscribe,
    () => (target && demoRegisterAllowed({ workspace: target.workspace, payments: demoPayments }) ? read(keyOf(target)).records : NO_RECEIPTS),
    () => NO_RECEIPTS,
  );
}
