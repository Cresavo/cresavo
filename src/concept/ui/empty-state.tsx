import type { ReactNode } from "react";

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-eko-line px-6 py-10 text-center">
      <div className="mb-1 flex size-12 items-center justify-center rounded-full bg-eko-sunken text-eko-muted">{icon}</div>
      <p className="font-medium">{title}</p>
      {text && <p className="max-w-xs text-sm text-eko-muted">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
