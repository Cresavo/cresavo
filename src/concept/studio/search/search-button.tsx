"use client";

import { Search } from "lucide-react";
import { t } from "../../i18n";
import { Button } from "../../ui/button";
import { openSearch, useMac } from "./search-palette";

/** The sidebar's way into Search, with its shortcut beside the word. */
export function SearchButton() {
  const mac = useMac();
  return (
    <Button data-help-id="shell.search" variant="tertiary" size="sm" align="between" aria-keyshortcuts="Control+K Meta+K" onClick={openSearch}
      className="studio-nav-link mt-2 w-full text-text-secondary hover:text-text">
      <span className="flex items-center gap-3"><Search size={18} aria-hidden />{t("palette.open")}</span>
      <kbd aria-hidden className="font-sans text-meta">{t(mac ? "palette.shortcut.mac" : "palette.shortcut.pc")}</kbd>
    </Button>
  );
}
