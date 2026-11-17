"use client";

import { useState } from "react";
import { CircleHelp } from "lucide-react";
import { t } from "../../i18n";
import { HelpSheet } from "./help-sheet";

/** The Help button in the studio header. Opens the help sheet. */
export function HelpButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-help="help-button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium text-eko-muted hover:bg-eko-sunken hover:text-eko-ink"
      >
        <CircleHelp size={18} />
        {t("help.button")}
      </button>
      <HelpSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
