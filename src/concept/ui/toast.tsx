"use client";

import { useSyncExternalStore } from "react";
import { CheckCircle2, X } from "lucide-react";
import { t, type MessageKey } from "../i18n";
import { DEFERRED_WRITE_FAILED } from "../support/deferred-write";
import { newActionRequestId } from "../support/action-reference";
import { ActionFailure, type ActionFailureInfo } from "./action-failure";
import { IconButton } from "./button";

// Short confirmations with an optional action such as "Undo".

type ToastAction = { label: string; run: () => void };
type ToastEntry = { id: number; closing?: boolean } & (
  | { message: string; action?: ToastAction }
  | { failure: ActionFailureInfo; audience: "studio" | "booking" }
);

let toasts: ToastEntry[] = [];
let counter = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showToast(message: string, action?: ToastAction) {
  const id = ++counter;
  toasts = [...toasts.slice(-2), { id, message, action }];
  emit();
  window.setTimeout(() => dismiss(id), 6000);
}

// A change that had to wait for the booking lock (while a personal offer is out) and was then refused.
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener(DEFERRED_WRITE_FAILED, () => showActionFailure("booking.visitChanged", undefined,
    window.location?.pathname.startsWith("/boka") ? "booking" : "studio"));
}

export function showActionFailure(reason: MessageKey, requestId = newActionRequestId(), audience: "studio" | "booking" = "studio", message?: string) {
  toasts = [...toasts.slice(-2), { id: ++counter, failure: { reason, requestId, message }, audience }];
  emit();
}

function dismiss(id: number) {
  if (!listeners.size) return remove(id);
  toasts = toasts.map(toast => toast.id === id ? { ...toast, closing: true } : toast);
  emit();
}

function remove(id: number) {
  toasts = toasts.filter(toast => toast.id !== id);
  emit();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const empty: ToastEntry[] = [];

export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => toasts, () => empty);
  return (
    <div aria-live="polite" className="ui-toaster pointer-events-none fixed inset-x-0 z-toast flex flex-col items-center gap-2 px-4">
      {list.map(toast => (
        <div key={toast.id} className="ui-toast pointer-events-auto w-full max-w-md"
          data-closing={toast.closing || undefined}
          inert={toast.closing}
          onAnimationEnd={event => {
            if (toast.closing && event.target === event.currentTarget) remove(toast.id);
          }}>
          {"failure" in toast ? (
            <div className="flex items-start gap-1 rounded-md bg-surface p-1 shadow-sheet ring-1 ring-hairline">
              <ActionFailure failure={toast.failure} audience={toast.audience} />
              <IconButton label={t("common.close")} onClick={() => dismiss(toast.id)}><X size={18} /></IconButton>
            </div>
          ) : (
            <Toast message={toast.message} action={toast.action && {
              label: toast.action.label,
              run: () => { dismiss(toast.id); toast.action?.run(); },
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

export function Toast({ message, action }: { message: string; action?: ToastAction }) {
  return (
    <div role="status" className="flex items-center gap-3 rounded-md bg-text px-4 py-3 text-body text-bg shadow-sheet">
      <CheckCircle2 aria-hidden size={18} className="shrink-0" />
      <span className="min-w-0 flex-1">{message}</span>
      {action && <button type="button" className="min-h-target min-w-target rounded-sm px-2 font-semibold underline underline-offset-2" onClick={action.run}>
        {action.label}
      </button>}
    </div>
  );
}
