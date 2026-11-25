"use client";

import { useState } from "react";
import { History, Undo2 } from "lucide-react";
import { toKey } from "../../data/dates";
import { formatTime } from "../../data/dates";
import { t } from "../../i18n";
import { relativeDay } from "../../i18n/format";
import { accountRecordSettled, useDemo } from "../../store";
import { filterLog, present, type LogFilter } from "../../log/filter";
import type { LogEntry } from "../../log/types";
import { undoBlockReason } from "../../log/undo";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { SegmentedControl } from "../../ui/controls";
import { ListRow } from "../../ui/list-row";
import { EmptyState } from "../../ui/empty-state";
import { useStudio } from "../use-studio";
import { undoBlockMessageKey, undoWithToast } from "./undo-toast";

/** "Today 10:42", "Mon 16 Nov 10:42". */
export function entryTime(at: number, today: string): string {
  const date = new Date(at);
  return `${relativeDay(toKey(date), today)} ${formatTime(date.getHours() * 60 + date.getMinutes())}`;
}

function Row({ entry, reason, today }: { entry: LogEntry; reason: ReturnType<typeof undoBlockReason>; today: string }) {
  const undoMessage = undoBlockMessageKey(reason);
  const settled = accountRecordSettled("log", entry.id);
  return (
    <li>
      <ListRow title={entry.summary} meta={<>
        {(entry.before || entry.after) && (
          <span className="block">
            {entry.before && <span>{entry.before}</span>}
            {entry.before && entry.after && <span aria-label={t("log.then")}> → </span>}
            {entry.after && <span className="text-text">{entry.after}</span>}
          </span>
        )}
        <span className="block">
          {entryTime(entry.at, today)} · {t(`log.actor.${entry.actor}`)} · {t(`log.source.${entry.source}`)}
        </span>
        {undoMessage && <span className="block">{t(undoMessage)}</span>}
      </>}
      trailing={entry.undone ? <Badge>{t("log.undone")}</Badge> : !reason && (
        <Button size="sm" variant="secondary" icon={<Undo2 size={16} />} disabled={!settled} onClick={() => undoWithToast(entry.id)}>{t("common.undo")}</Button>
      )} />
    </li>
  );
}

/** Everything that changed, newest first, with filters and Undo where it is still possible. */
export function ActivityList() {
  const { state, today } = useStudio();
  // Undo is checked against the salon as it is saved: the studio's view translates demo copy, which is not a change.
  const saved = useDemo() ?? state;
  const [filter, setFilter] = useState<LogFilter>({});
  const actors = present(state.log, "actor");
  const sources = present(state.log, "source");
  const shown = filterLog(state.log, filter);

  if (!state.log.length) return <EmptyState icon={<History size={22} />} title={t("log.empty")} text={t("log.emptyText")} />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <SegmentedControl label={t("log.filter.who")} value={filter.actor ?? ""}
          onChange={actor => setFilter({ ...filter, actor: actor || undefined })}
          options={[{ value: "", label: t("log.filter.all") }, ...actors.map(value => ({ value, label: t(`log.actor.${value}`) }))]} />
        {sources.length > 1 && (
          <SegmentedControl label={t("log.filter.where")} value={filter.source ?? ""}
            onChange={source => setFilter({ ...filter, source: source || undefined })}
            options={[{ value: "", label: t("log.filter.anywhere") }, ...sources.map(value => ({ value, label: t(`log.source.${value}`) }))]} />
        )}
      </div>
      {shown.length ? (
        <Card>
          <ul className="divide-y divide-hairline">
            {shown.map((entry) => (
              <Row key={entry.id} entry={entry} reason={undoBlockReason(saved, entry)} today={today} />
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState icon={<History size={22} />} title={t("log.noMatch")}
          action={<Button variant="secondary" onClick={() => setFilter({})}>{t("log.showAll")}</Button>} />
      )}
    </div>
  );
}
