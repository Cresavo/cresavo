"use client";

import type { ReactNode } from "react";
import { Eye, Info } from "lucide-react";
import { startShowMe } from "../help/pointer/store";
import { t } from "../i18n";
import { Button } from "./button";
import { cx } from "./cx";
import type { FriendlyMessage } from "./friendly-copy";

export { friendlyMessage, friendlyText, logForSupport, type FriendlyMessage } from "./friendly-copy";

/**
 * A calm message for something that did not work or is not set up yet: what happened, why, and what to do, with
 * an optional "Show me" that points at the place to fix it. Neutral surface and mark, never alarm red: use
 * `Notice tone="danger"` only where something is lost and cannot be recovered.
 */
export function FriendlyNotice({ message, action, onShowMe, className }: {
  message: FriendlyMessage;
  /** One more way forward, such as Try again. */
  action?: ReactNode;
  /** Called before "Show me" starts, for example to close the sheet the message is in. */
  onShowMe?: () => void;
  className?: string;
}) {
  return (
    <div role="status" className={cx("flex items-start gap-3 rounded-md bg-surface-2 px-4 py-3 text-body text-text", className)}>
      <Info aria-hidden size={18} className="mt-0.5 shrink-0 text-text-secondary" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">{message.what}</p>
        {message.why && <p className="text-text-secondary">{message.why}</p>}
        <p>{message.next}</p>
        {(message.showMe || action) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {message.showMe && (
              <Button size="sm" variant="secondary" icon={<Eye size={16} aria-hidden />}
                onClick={() => { onShowMe?.(); startShowMe(message.showMe!); }}>
                {t("showMe.submit")}
              </Button>
            )}
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
