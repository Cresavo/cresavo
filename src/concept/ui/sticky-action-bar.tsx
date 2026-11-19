import type { ReactNode } from "react";

/** The footer occupies its own grid row. The scrollport always ends above its measured height. */
export function StickyActionBar({ children, actions, label }: { children: ReactNode; actions: ReactNode; label: string }) {
  return (
    <div className="ui-action-layout min-w-0">
      <div role="region" aria-label={label} tabIndex={0} className="min-h-0 overflow-y-auto p-4">{children}</div>
      <div className="ui-action-bar flex flex-wrap justify-end gap-2 border-t border-hairline bg-surface px-4 pt-3">{actions}</div>
    </div>
  );
}
