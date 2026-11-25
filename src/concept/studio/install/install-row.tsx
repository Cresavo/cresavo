"use client";

import { useState } from "react";
import { Share, SquarePlus } from "lucide-react";
import { t } from "../../i18n";
import { ListRow } from "../../ui/list-row";
import { Sheet } from "../../ui/sheet";
import { promptInstall, useInstallWay } from "./install";

/**
 * A quiet row under More: add the studio to the home screen. Where the browser has its own install dialog the row
 * opens it; on an iPhone, which has none, it says where Safari keeps the choice. It is not there when the studio
 * is already installed or the browser cannot install it.
 */
export function InstallRow({ className }: { className?: string }) {
  const way = useInstallWay();
  const [guide, setGuide] = useState(false);
  if (!way) return null;
  return (
    <div className={className}>
      <ListRow
        title={t("install.title")}
        meta={t("install.text")}
        leading={<SquarePlus size={22} aria-hidden className="shrink-0 text-text-secondary" />}
        onClick={() => (way === "prompt" ? void promptInstall() : setGuide(true))}
      />
      <Sheet open={guide} onClose={() => setGuide(false)} title={t("install.title")}>
        <p className="flex items-start gap-2 text-body">
          <Share size={18} aria-hidden className="mt-1 shrink-0 text-text-secondary" />
          <span>{t("install.ios")}</span>
        </p>
      </Sheet>
    </div>
  );
}
