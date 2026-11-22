"use client";

import { Button } from "../../ui/button";
import { useState } from "react";
import { CircleHelp } from "lucide-react";
import { t } from "../../i18n";
import { cx } from "../../ui/cx";
import { HelpSheet } from "./help-sheet";
import { WhatsNewSheet } from "./whats-new-sheet";
import { useHasUnseenUpdates } from "./whats-new-seen";

/** The Help button in the studio header. Opens the help sheet. `compact` shows the icon only (phone top bar). A dot marks unseen updates. */
export function HelpButton({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [updates, setUpdates] = useState(false);
  const unseen = useHasUnseenUpdates();
  return (
    <>
      <Button variant="tertiary" size="sm"
        type="button"
        data-help="help-button"
        onClick={() => setOpen(true)}
        aria-label={compact ? t("help.button") : undefined}
        className={cx("relative text-text-secondary hover:text-text", compact && "size-target !p-0")}
      >
        <CircleHelp size={compact ? 22 : 18} aria-hidden />
        {!compact && t("help.button")}
        {unseen && (
          <span role="img" aria-label={t("whatsNew.dot")} data-testid="whats-new-dot"
            className={cx("absolute size-2 rounded-full bg-action", compact ? "right-2 top-2" : "right-0.5 top-0.5")} />
        )}
      </Button>
      <HelpSheet open={open} onClose={() => setOpen(false)} onWhatsNew={() => { setOpen(false); setUpdates(true); }} />
      <WhatsNewSheet open={updates} onClose={() => setUpdates(false)} />
    </>
  );
}
