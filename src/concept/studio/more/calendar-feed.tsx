"use client";

import { Input } from "../../ui/controls";
import { useEffect, useState } from "react";
import { CalendarPlus, ChevronDown } from "lucide-react";
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

/** One person's read-only calendar subscription link, folded until someone wants it. */
export function CalendarFeed({ name, path }: { name: string; path: string }) {
  const url = `${window.location.origin}${path}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      showToast(t("feed.copied"));
    } catch {
      showToast(t("giftcards.copyFailed"));
    }
  };
  return (
    <details className="group border-t border-hairline pt-2">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <CalendarPlus size={16} className="text-text-secondary" aria-hidden />
        <span className="flex-1">{t("feed.title")}</span>
        <ChevronDown size={16} aria-hidden className="text-text-secondary transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-2 pb-1">
        <p className="text-sm text-text-secondary">{t("feed.text", { name })}</p>
        <Input readOnly value={url} aria-label={t("feed.title")} onFocus={(event) => event.target.select()} />
        <Button size="sm" variant="secondary" onClick={copy}>{t("feed.copy")}</Button>
        <p className="text-xs text-text-secondary">{t("feed.how")}</p>
      </div>
    </details>
  );
}
