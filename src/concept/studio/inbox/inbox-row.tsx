import { inboxTimestamp } from "../../data/dates";
import type { DateKey, DemoState, InboxItem } from "../../data/types";
import { t } from "../../i18n";
import { relativeDay, formatTime } from "../../i18n/format";
import { cx } from "../../ui/cx";
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
    <button
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={cx("flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2", selected && "bg-action-bg/60 hover:bg-action-bg/60")}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className={cx("min-w-0 flex-1 break-words", item.read ? "font-medium" : "font-semibold")}>{item.title}</p>
          <span className="shrink-0 text-xs tabular-nums text-text-secondary">
            {at.date === today ? formatTime(at.time) : relativeDay(at.date, today)}
          </span>
        </div>
        <p className="truncate text-sm text-text-secondary">{senderName(state, item) ?? t("inbox.system")}</p>
        <p className="truncate text-sm text-text-secondary">{item.body}</p>
      </div>
      <span className="mt-1.5 flex w-2.5 shrink-0 justify-center">
        {!item.read && <span className="size-2.5 rounded-full bg-action" role="img" aria-label={t("inbox.unread")} />}
        {item.read && !item.handled && item.draftReply && <span className="size-2 rounded-full ring-2 ring-inset ring-action/50" role="img" aria-label={t("inbox.needsReply")} />}
      </span>
    </button>
  );
}
