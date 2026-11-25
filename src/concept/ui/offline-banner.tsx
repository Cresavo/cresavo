"use client";

import { WifiOff } from "lucide-react";
import { t } from "../i18n";
import { Button } from "./button";
import { checkConnection, useConnection } from "./connection";
import { cx } from "./cx";

/**
 * A slim band that stays while the server cannot be reached: what still works, and a way to try again. It goes
 * quietly when the connection is back. `studio`: the salon on screen stays readable; `booking`: the page can be
 * read, but booking, changing and paying wait for the connection.
 */
export function OfflineBanner({ area, className }: { area: "studio" | "booking"; className?: string }) {
  const connection = useConnection();
  if (connection === "online") return null;
  return (
    <div role="status" className={cx("ui-band sticky top-0 z-sticky flex flex-wrap items-center gap-x-3 gap-y-1 bg-surface-2 px-4 py-1 text-meta text-text print:hidden", className)}>
      <WifiOff aria-hidden size={16} className="shrink-0 text-text-secondary" />
      <p className="min-w-0 flex-1">{t(area === "studio" ? "connection.offline.studio" : "connection.offline.booking")}</p>
      <Button variant="tertiary" size="sm" loading={connection === "checking"} onClick={() => void checkConnection()}>
        {t("connection.retry")}
      </Button>
    </div>
  );
}
