"use client";

import { useEffect, useState } from "react";
import { CheckCheck, Inbox as InboxIcon, MousePointerClick } from "lucide-react";
import type { InboxItem } from "@/concept/data/types";
import { t, tc } from "@/concept/i18n";
import { unreadCount } from "@/concept/selectors";
import { dispatch } from "@/concept/store";
import { InboxDetail } from "@/concept/studio/inbox/inbox-detail";
import { senderName } from "@/concept/studio/inbox/inbox-meta";
import { InboxRow } from "@/concept/studio/inbox/inbox-row";
import { PageHeader } from "@/concept/studio/page-header";
import { useStudio } from "@/concept/studio/use-studio";
import { Button } from "@/concept/ui/button";
import { Card } from "@/concept/ui/card";
import { Segmented } from "@/concept/ui/controls";
import { EmptyState } from "@/concept/ui/empty-state";
import { Sheet } from "@/concept/ui/sheet";

type Filter = "all" | "unread" | "requests" | "reviews" | "sent";

const matches: Record<Filter, (item: InboxItem) => boolean> = {
  sent: item => !!item.delivery || !!item.recallServiceId,
  all: () => true,
  unread: (i) => !i.read,
  requests: (i) => i.kind === "request" || i.kind === "reschedule" || i.kind === "cancel" || i.kind === "message",
  reviews: (i) => i.kind === "review",
};

export default function InboxPage() {
  const { state, today } = useStudio();
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setSheetOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  const items = state.inbox.filter(matches[filter]);
  const selected = state.inbox.find((i) => i.id === selectedId);
  const unread = unreadCount(state);

  const select = (item: InboxItem) => {
    setSelectedId(item.id);
    setSheetOpen(!window.matchMedia("(min-width: 1024px)").matches);
    if (!item.read) dispatch({ type: "inbox/read", id: item.id });
  };

  return (
    <>
      <PageHeader
        title={t("inbox.title")}
        subtitle={unread ? tc("inbox.subtitle", unread) : t("inbox.allRead")}
        actions={
          <Button variant="secondary" icon={<CheckCheck size={18} />} disabled={!unread} onClick={() => dispatch({ type: "inbox/read-all" })}>
            {t("inbox.markAllRead")}
          </Button>
        }
      />
      <Segmented<Filter>
        label={t("inbox.filter")}
        value={filter}
        onChange={setFilter}
        className="mb-4 w-full sm:w-auto"
        options={[
          { value: "all", label: t("inbox.filter.all") },
          { value: "unread", label: t("inbox.filter.unread") },
          { value: "requests", label: t("inbox.filter.requests") },
          { value: "reviews", label: t("inbox.filter.reviews") },
          { value: "sent", label: t("messages.log") },
        ]}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        {items.length ? (
          <Card className="divide-y divide-eko-line self-start overflow-hidden">
            {items.map((item) => (
              <InboxRow key={item.id} state={state} item={item} today={today} selected={item.id === selectedId} onSelect={() => select(item)} />
            ))}
          </Card>
        ) : (
          <EmptyState icon={<InboxIcon size={22} />} title={t("inbox.empty")} />
        )}
        <div className="hidden lg:block">
          {selected ? (
            <Card className="p-6">
              <InboxDetail key={selected.id} item={selected} />
            </Card>
          ) : (
            <EmptyState icon={<MousePointerClick size={22} />} title={t("inbox.pick")} text={t("inbox.pickText")} />
          )}
        </div>
      </div>
      <div className="lg:hidden">
        {selected && (
          <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={selected.title} description={senderName(state, selected)}>
            <InboxDetail key={selected.id} item={selected} onDone={() => setSheetOpen(false)} />
          </Sheet>
        )}
      </div>
    </>
  );
}
