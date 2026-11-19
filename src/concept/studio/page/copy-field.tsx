"use client";

import { useState } from "react";
import { t } from "../../i18n";
import { Button } from "../../ui/button";
import { showToast } from "../../ui/toast";

/** A value the owner has to copy somewhere else (a DNS record, an address). */
export function CopyField({ label, value, onCopied }: { label: string; value: string; onCopied?: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      onCopied?.();
    } catch {
      showToast(t("share.failed"));
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md bg-surface-2 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</p>
        <p className="break-all font-mono text-sm">{value}</p>
      </div>
      <Button size="sm" variant="secondary" aria-label={t("address.copyField", { field: label })} onClick={copy}>
        {t(copied ? "common.copied" : "common.copy")}
      </Button>
    </div>
  );
}
