"use client";

import { useEffect, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { t } from "../../i18n";
import { Button } from "../../ui/button";
import { showToast } from "../../ui/toast";

/** Feed paths per person from the server; `null` while loading or when feeds are switched off. */
export function useCalendarFeeds(): Record<string, string> | null {
  const [feeds, setFeeds] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    let current = true;
    fetch("/api/concept/calendar")
      .then((response) => (response.ok ? response.json() : { feeds: [] }))
      .then((body: { feeds: { staffId: string; path: string }[] }) => {
        if (current) setFeeds(Object.fromEntries(body.feeds.map((feed) => [feed.staffId, feed.path])));
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, []);
  return feeds;
}

/** One person's read-only calendar subscription link. */
export function CalendarFeed({ name, path }: { name: string; path: string | undefined }) {
  const url = path ? `${window.location.origin}${path}` : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      showToast(t("feed.copied"));
    } catch {
      showToast(t("giftcards.copyFailed"));
    }
  };
  return (
    <div className="space-y-2 border-t border-eko-line pt-4">
      <p className="flex items-center gap-2 text-sm font-medium"><CalendarPlus size={16} className="text-eko-accent" aria-hidden />{t("feed.title")}</p>
      {path ? (
        <>
          <p className="text-sm text-eko-muted">{t("feed.text", { name })}</p>
          <input readOnly value={url} aria-label={t("feed.title")} onFocus={(event) => event.target.select()} className="w-full rounded-xl border border-eko-line bg-eko-sunken p-3 text-xs" />
          <Button size="sm" variant="secondary" onClick={copy}>{t("feed.copy")}</Button>
          <p className="text-xs text-eko-muted">{t("feed.how")}</p>
        </>
      ) : (
        <p className="text-sm text-eko-muted">{t("feed.off")}</p>
      )}
    </div>
  );
}
