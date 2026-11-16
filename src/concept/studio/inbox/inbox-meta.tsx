import { Bell, CalendarClock, CalendarX2, MessageCircle, MessageSquare, Star } from "lucide-react";
import type { DemoState, InboxItem, InboxKind } from "../../data/types";
import type { MessageKey } from "../../i18n";
import { findCustomer, fullName } from "../../selectors";
import { Avatar } from "../../ui/avatar";

export const KIND_LABEL: Record<InboxKind, MessageKey> = {
  request: "inbox.kind.request",
  reschedule: "inbox.kind.reschedule",
  cancel: "inbox.kind.cancel",
  review: "inbox.kind.review",
  message: "inbox.kind.message",
  system: "inbox.kind.system",
};

const KIND_ICON = {
  request: MessageSquare,
  reschedule: CalendarClock,
  cancel: CalendarX2,
  review: Star,
  message: MessageCircle,
  system: Bell,
} satisfies Record<InboxKind, unknown>;

export function senderName(state: DemoState, item: InboxItem): string | undefined {
  const customer = findCustomer(state, item.customerId);
  return customer ? fullName(customer) : item.fromName;
}

/** Customer avatar, or an icon for system messages. */
export function InboxAvatar({ state, item }: { state: DemoState; item: InboxItem }) {
  const name = senderName(state, item);
  if (name && item.kind !== "system") return <Avatar name={name} />;
  const Icon = KIND_ICON[item.kind];
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-eko-sunken text-eko-muted">
      <Icon size={18} />
    </span>
  );
}

export function KindIcon({ kind, size = 14 }: { kind: InboxKind; size?: number }) {
  const Icon = KIND_ICON[kind];
  return <Icon size={size} />;
}
