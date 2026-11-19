import type { ReactNode } from "react";

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-hairline px-6 py-8 text-center">
      <div className="mb-1 flex size-12 items-center justify-center rounded-full bg-surface-2 text-text-secondary">{icon}</div>
      <p className="text-h3 font-medium">{title}</p>
      {text && <p className="max-w-xs text-body text-text-secondary">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
