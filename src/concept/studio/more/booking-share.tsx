"use client";

import { useState } from "react";
import { bookingShare } from "../../booking/share";
import { t } from "../../i18n";
import { Button, ButtonLink } from "../../ui/button";
import { Card } from "../../ui/card";
import { showToast } from "../../ui/toast";
import { useStudio } from "../use-studio";

export function BookingShare() {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const { state } = useStudio();
  const share = bookingShare(window.location.origin, state.salon.slug, state.salon.name);
  const copy = async (kind: "link" | "code") => {
    try { await navigator.clipboard.writeText(share[kind]); setCopied(kind); }
    catch { showToast(t("share.failed")); }
  };
  return <Card className="space-y-4 p-5">
    <p className="text-sm text-text-secondary">{t("share.help")}</p>
    <div className="space-y-2">
      <label className="block text-sm font-medium" htmlFor="booking-bio-link">{t("share.bio")}</label>
      <input className="w-full rounded-md border border-border bg-surface-2 p-3 text-base" id="booking-bio-link" readOnly value={share.link} onFocus={event => event.target.select()} />
      <Button size="sm" variant="secondary" onClick={() => copy("link")}>{t(copied === "link" ? "common.copied" : "share.copyLink")}</Button>
    </div>
    <div className="space-y-2">
      <label className="block text-sm font-medium" htmlFor="booking-widget-code">{t("share.code")}</label>
      <textarea className="min-h-36 w-full rounded-md border border-border bg-surface-2 p-3 font-mono text-base" id="booking-widget-code" readOnly value={share.code} onFocus={event => event.target.select()} />
      <Button size="sm" variant="secondary" onClick={() => copy("code")}>{t(copied === "code" ? "common.copied" : "share.copyCode")}</Button>
    </div>
    <div className="flex flex-wrap gap-2"><ButtonLink href={share.link} variant="secondary">{t("share.open")}</ButtonLink><ButtonLink href={share.widget} variant="secondary">{t("share.preview")}</ButtonLink></div>
  </Card>;
}
