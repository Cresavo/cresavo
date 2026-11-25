import type { ReactNode } from "react";

/** A genuinely empty result: one icon that settles in once, one title, an optional sentence and the next step. No frame, no plate. */
export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
      <div aria-hidden="true" className="ui-empty-icon mb-1 text-text-secondary">{icon}</div>
      <p className="text-h3 font-medium text-text">{title}</p>
      {text && <p className="max-w-sm text-body text-text-secondary">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
