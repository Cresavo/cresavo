"use client";

import { PairedInbox } from "@/concept/studio/pairing/inbox";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCheck, Inbox as InboxIcon, MousePointerClick } from "lucide-react";
import type { InboxItem } from "@/concept/data/types";
import { t, tc } from "@/concept/i18n";
import { inboxItemVisible, unreadCount } from "@/concept/selectors";
import { dispatch } from "@/concept/store";
import { AgentProposalCard } from "@/concept/studio/inbox/agent-proposal-card";
import { useAgentProposals } from "@/concept/studio/inbox/agent-proposals";
import { InboxDetail } from "@/concept/studio/inbox/inbox-detail";
import { senderName } from "@/concept/studio/inbox/inbox-meta";
import { InboxRow } from "@/concept/studio/inbox/inbox-row";
import { reviewInboxItems } from "@/concept/studio/inbox/review-items";
import { showUndoToast } from "@/concept/studio/log/undo-toast";
import { PageHeader } from "@/concept/studio/page-header";
import { useStudio } from "@/concept/studio/use-studio";
import { bookingHome } from "@/concept/booking/links";
import { Button, ButtonLink } from "@/concept/ui/button";
import type { AgentProposal } from "@/concept/tools/agent-proposal";
import { Card, Section } from "@/concept/ui/card";
import { SegmentedControl } from "@/concept/ui/controls";
import { EmptyState } from "@/concept/ui/empty-state";
import { Sheet } from "@/concept/ui/sheet";
import { showActionFailure, showToast } from "@/concept/ui/toast";

type Filter = "all" | "unread" | "requests" | "reviews" | "sent";

const matches: Record<Filter, (item: InboxItem) => boolean> = {
  sent: item => !!item.delivery || !!item.recallServiceId || !!item.waitlistOffer,
  all: () => true,
  unread: (i) => !i.read,
  requests: (i) => i.kind === "request" || i.kind === "reschedule" || i.kind === "cancel" || i.kind === "message",
  reviews: (i) => i.kind === "review",
};

export default function InboxPage() {
  return <Suspense><InboxPageContent /></Suspense>;
}

function InboxPageContent() {
  const { state, today, minutes } = useStudio();
  const router = useRouter();
  const param = useSearchParams()?.get("filter");
  const filter = param && Object.hasOwn(matches, param) && (param !== "reviews" || state.modules.reviews) ? param as Filter : "all";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setSheetOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  const inbox = state.inbox.filter((item) => inboxItemVisible(state, item));
  const items = filter === "reviews" ? reviewInboxItems(state.reviews, inbox) : inbox.filter(matches[filter]);
  const selected = (filter === "reviews" ? items : inbox).find((item) => item.id === selectedId);
  const unread = unreadCount(state);
  const { proposals, decide } = useAgentProposals(!state.industry);

  const approve = (proposal: AgentProposal) => {
    if (!showUndoToast(proposal.toast, decide(proposal, true))) showActionFailure("agents.failed", proposal.id);
  };
  const decline = (proposal: AgentProposal) => {
    decide(proposal, false);
    showToast(t("agents.declined"));
  };

  const select = (item: InboxItem) => {
    setSelectedId(item.id);
    setSheetOpen(!window.matchMedia("(min-width: 1024px)").matches);
    if (!item.read) dispatch({ type: "inbox/read", id: item.id });
  };

  if (filter !== "sent" && !state.modules.reviews && state.industry && !inbox.length && !proposals.length) {
    return <>
      <PageHeader title={t("inbox.title")} />
      <PairedInbox />
      <EmptyState icon={<InboxIcon size={22} />} title={t("setup.empty.inbox")}
        action={<ButtonLink href={bookingHome(state.salon.slug)}>{t("share.open")}</ButtonLink>} />
    </>;
  }

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
      <PairedInbox />
      {proposals.length > 0 && (
        <Section title={t("agents.title")} className="mb-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {proposals.map((proposal) => (
              <AgentProposalCard key={proposal.id} proposal={proposal} onApprove={() => approve(proposal)} onDecline={() => decline(proposal)} />
            ))}
          </div>
        </Section>
      )}
      <SegmentedControl<Filter>
        label={t("inbox.filter")}
        fit
        value={filter}
        onChange={(next) => {
          if (selected && (!matches[next](selected) || (next !== "reviews" && !inbox.includes(selected)))) {
            setSelectedId(null);
            setSheetOpen(false);
          }
          router.replace(next === "all" ? "/studio/inbox" : `/studio/inbox?filter=${next}`, { scroll: false });
        }}
        className="mb-4"
        options={[
          { value: "all", label: t("inbox.filter.all") },
          { value: "unread", label: t("inbox.filter.unread") },
          { value: "requests", label: t("inbox.filter.requests") },
          ...(state.modules.reviews ? [{ value: "reviews" as const, label: t("inbox.filter.reviews") }] : []),
          { value: "sent", label: t("messages.log") },
        ]}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        {items.length ? (
          <Card className="divide-y divide-hairline self-start overflow-hidden">
            {items.map((item) => (
              <InboxRow key={item.id} state={state} item={item} today={today} minutes={minutes} selected={item.id === selectedId} onSelect={() => select(item)} />
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
          ) : items.length > 0 && (
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
