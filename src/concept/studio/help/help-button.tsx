"use client";

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
      <button
        type="button"
        data-help="help-button"
        onClick={() => setOpen(true)}
        aria-label={compact ? t("help.button") : undefined}
        className={cx("inline-flex min-h-11 items-center gap-2 rounded-md text-[15px] font-medium text-text-secondary hover:bg-surface-2 hover:text-text", compact ? "min-w-11 justify-center" : "px-3")}
      >
        <CircleHelp size={compact ? 22 : 18} aria-hidden />
        {!compact && t("help.button")}
      </button>
      <HelpSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
