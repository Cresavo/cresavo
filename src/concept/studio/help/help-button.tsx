"use client";

import { Button } from "../../ui/button";
import { useState } from "react";
import { CircleHelp } from "lucide-react";
import { t } from "../../i18n";
import { cx } from "../../ui/cx";
import { HelpSheet } from "./help-sheet";

/** The Help button in the studio header. Opens the help sheet. `compact` shows the icon only (phone top bar). */
export function HelpButton({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="tertiary" size="sm"
        type="button"
        data-help="help-button"
        onClick={() => setOpen(true)}
        aria-label={compact ? t("help.button") : undefined}
        className={cx("text-text-secondary hover:text-text", compact && "size-target !p-0")}
      >
        <CircleHelp size={compact ? 22 : 18} aria-hidden />
        {!compact && t("help.button")}
      </Button>
      <HelpSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
