"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { t } from "../../i18n";
import { formatDate } from "../../i18n/format";
import { ListRow } from "../../ui/list-row";
import { Sheet } from "../../ui/sheet";
import { WHATS_NEW } from "../../whats-new";
import { markSeen } from "./whats-new-seen";

/** The latest releases in plain language. Opening it marks the newest one as seen on this device. */
export function WhatsNewSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  useEffect(() => {
    if (open) markSeen();
  }, [open]);

  return (
    <Sheet open={open} onClose={onClose} title={t("whatsNew.title")} description={t("whatsNew.description")}>
      <div className="space-y-5 pt-2">
        {WHATS_NEW.map((entry) => (
          <section key={entry.version} aria-labelledby={`whats-new-${entry.version}`}>
            <h3 id={`whats-new-${entry.version}`} className="text-body font-semibold">
              {t("whatsNew.release", { version: entry.version })}
              <span className="ml-2 text-sm font-normal text-text-secondary">{formatDate(entry.date)}</span>
            </h3>
            <ul className="mt-2 space-y-2">
              {entry.items.map((item) => (
                <li key={item.text} className="text-body">
                  {item.href ? (
                    <ListRow
                      onClick={() => { onClose(); router.push(item.href as string); }}
                      title={t(item.text)}
                      trailing={<ChevronRight size={18} aria-hidden className="shrink-0 text-text-secondary" />}
                      className="-mx-4 w-auto"
                    />
                  ) : t(item.text)}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Sheet>
  );
}
