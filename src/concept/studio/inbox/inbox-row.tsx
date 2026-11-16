import { formatTime } from "../../data/dates";
import type { DateKey, DemoState, InboxItem } from "../../data/types";
import { t } from "../../i18n";
import { relativeDay } from "../../i18n/format";
import { cx } from "../../ui/cx";
import { InboxAvatar, senderName } from "./inbox-meta";

interface InboxRowProps {
  state: DemoState;
  item: InboxItem;
  today: DateKey;
  selected: boolean;
  onSelect: () => void;
}

export function InboxRow({ state, item, today, selected, onSelect }: InboxRowProps) {
  return (
    <button
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={cx("flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-eko-sunken", selected && "bg-eko-accent-soft/60 hover:bg-eko-accent-soft/60")}
    >
      <InboxAvatar state={state} item={item} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className={cx("min-w-0 flex-1 truncate", item.read ? "font-medium" : "font-semibold")}>{senderName(state, item) ?? t("inbox.system")}</p>
          <span className="shrink-0 text-xs tabular-nums text-eko-muted">
            {item.date === today ? formatTime(item.time) : relativeDay(item.date, today)}
          </span>
        </div>
        <p className={cx("truncate text-sm", item.read ? "text-eko-muted" : "font-medium")}>{item.title}</p>
        <p className="truncate text-sm text-eko-muted">{item.body}</p>
      </div>
      <span className="mt-1.5 flex w-2.5 shrink-0 justify-center">
        {!item.read && <span className="size-2.5 rounded-full bg-eko-accent" aria-label={t("inbox.unread")} />}
        {item.read && !item.handled && item.draftReply && <span className="size-2 rounded-full ring-2 ring-inset ring-eko-accent/50" aria-label={t("inbox.needsReply")} />}
      </span>
    </button>
  );
}
