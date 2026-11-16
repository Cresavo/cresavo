"use client";

import { useSyncExternalStore } from "react";
import { CheckCircle2 } from "lucide-react";

// Short confirmations with an optional action such as "Undo".

interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

let toasts: Toast[] = [];
let counter = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showToast(message: string, action?: Toast["action"]) {
  const id = ++counter;
  toasts = [...toasts.slice(-2), { id, message, action }];
  emit();
  window.setTimeout(() => dismiss(id), 6000);
}

function dismiss(id: number) {
  toasts = toasts.filter((x) => x.id !== id);
  emit();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const empty: Toast[] = [];

export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => toasts, () => empty);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6">
      {list.map((toast) => (
        <div key={toast.id} className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-eko-ink px-4 py-3 text-sm text-eko-bg shadow-sheet">
          <CheckCircle2 size={18} className="shrink-0 opacity-80" />
          <span className="min-w-0 flex-1">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className="rounded-lg px-2 py-1 font-semibold underline-offset-2 hover:underline"
              onClick={() => {
                toast.action!.run();
                dismiss(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
