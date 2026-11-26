import { inboxTimestamp } from "../../data/dates";
import type { DateKey, DemoState, InboxItem } from "../../data/types";
import { t } from "../../i18n";
import { relativeDay, formatTime } from "../../i18n/format";
import { Badge } from "../../ui/badge";
import { ListRow } from "../../ui/list-row";
import { senderName } from "./inbox-meta";

interface InboxRowProps {
  state: DemoState;
  item: InboxItem;
  today: DateKey;
  minutes: number;
  selected: boolean;
  onSelect: () => void;
}

export function InboxRow({ state, item, today, minutes, selected, onSelect }: InboxRowProps) {
  const at = inboxTimestamp(item, today, minutes);
  return (
    <ListRow
      helpId="inbox.message"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={selected ? "bg-action-bg/60 hover:bg-action-bg/60" : undefined}
      title={<span className="flex items-baseline gap-2">
        <span className={item.read ? "min-w-0 flex-1" : "min-w-0 flex-1 font-semibold"}>{item.title}</span>
        <span className="shrink-0 text-meta font-normal tabular-nums text-text-secondary">
          {at.date === today && item.kind !== "review" ? formatTime(at.time) : relativeDay(at.date, today)}
        </span>
      </span>}
      meta={<>
        <span className="block truncate">{senderName(state, item) ?? t("inbox.system")}</span>
        <span className="block truncate">{item.body}</span>
        {!item.read && (
          <span className="inline-flex items-center gap-2 font-medium text-text"><span aria-hidden className="size-2 shrink-0 rounded-full bg-action" />{t("inbox.unread")}</span>
        )}
        {item.read && !item.handled && item.draftReply && <Badge>{t("inbox.needsReply")}</Badge>}
      </>}
    />
  );
}
