import { Copy } from "lucide-react";
import { useState } from "react";
import { bookingHome } from "../../booking/links";
import { t } from "../../i18n";
import { dispatch } from "../../store";
import { Button } from "../../ui/button";
import { showToast } from "../../ui/toast";

export function recordShare(slug: string) {
  dispatch({ type: "card/dismiss", id: `shared:${slug}` });
}

export function CopyBookingLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + bookingHome(slug));
      recordShare(slug);
      setCopied(true);
    } catch { showToast(t("share.failed")); }
  };
  return <Button variant="secondary" icon={<Copy size={16} />} onClick={copy}><span aria-live="polite">{t(copied ? "common.copied" : "share.copyLink")}</span></Button>;
}
