"use client";

import { Input, Textarea } from "../../ui/controls";
import { useState } from "react";
import { bookingShare } from "../../booking/share";
import { t } from "../../i18n";
import { recordShare } from "../onboarding/booking-link";
import { Button, ButtonLink } from "../../ui/button";
import { Card, Section } from "../../ui/card";
import { showToast } from "../../ui/toast";
import { useStudio } from "../use-studio";

function useShare() {
  const { state } = useStudio();
  const share = bookingShare(window.location.origin, state.salon.slug, state.salon.name, state.localization.language);
  return { state, share };
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    showToast(t("share.failed"));
    return false;
  }
}

/** The salon's booking link, to copy into an Instagram bio or a message, and to open. */
export function BookingShare() {
  const [copied, setCopied] = useState(false);
  const { state, share } = useShare();
  const copy = async () => {
    if (!await copyText(share.link)) return;
    setCopied(true);
    if (state.industry) recordShare(state.salon.slug);
  };
  return <Card className="space-y-4 p-5">
    <p className="text-sm text-text-secondary">{t(state.industry ? "setup.local" : "share.help")}</p>
    <div className="space-y-2">
      <label className="block text-sm font-medium" htmlFor="booking-bio-link">{t("share.bio")}</label>
      <Input id="booking-bio-link" readOnly value={share.link} onFocus={event => event.target.select()} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" width="responsive" variant="secondary" onClick={copy}>{t(copied ? "common.copied" : "share.copyLink")}</Button>
        <ButtonLink size="sm" width="responsive" href={share.link} variant="secondary">{t("share.open")}</ButtonLink>
      </div>
    </div>
  </Card>;
}

/** Advanced: the code that puts the booking page on the salon's own website. */
export function EmbedCode() {
  const [copied, setCopied] = useState(false);
  const { share } = useShare();
  return <Section title={t("share.title")}>
    <Card className="space-y-4 p-5">
      <p className="text-sm text-text-secondary">{t("share.codeHelp")}</p>
      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="booking-widget-code">{t("share.code")}</label>
        <Textarea className="font-mono" id="booking-widget-code" readOnly value={share.code} onFocus={event => event.target.select()} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" width="responsive" variant="secondary" onClick={async () => setCopied(await copyText(share.code))}>{t(copied ? "common.copied" : "share.copyCode")}</Button>
          <ButtonLink size="sm" width="responsive" href={share.widget} variant="secondary">{t("share.preview")}</ButtonLink>
        </div>
      </div>
    </Card>
  </Section>;
}
