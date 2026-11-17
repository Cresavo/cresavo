"use client";

import { useState } from "react";
import { History, Undo2 } from "lucide-react";
import { toKey } from "../../data/dates";
import { formatTime } from "../../data/dates";
import { t } from "../../i18n";
import { relativeDay } from "../../i18n/format";
import { filterLog, present, type LogFilter } from "../../log/filter";
import type { LogEntry } from "../../log/types";
import { isUndoable } from "../../log/undo";
import { dispatch } from "../../store";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { Chip } from "../../ui/controls";
import { EmptyState } from "../../ui/empty-state";
import { showToast } from "../../ui/toast";
import { useStudio } from "../use-studio";

/** "Today 10:42", "Mon 16 Nov 10:42". */
function entryTime(at: number, today: string): string {
  const date = new Date(at);
  return `${relativeDay(toKey(date), today)} ${formatTime(date.getHours() * 60 + date.getMinutes())}`;
}

function Row({ entry, canUndo, today }: { entry: LogEntry; canUndo: boolean; today: string }) {
  const undo = () => showToast(dispatch({ type: "log/undo", id: entry.id }) ? t("log.undoneToast") : t("log.cannotUndo"));
  return (
    <li className="flex items-start gap-3 px-4 py-3.5">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-[15px] font-medium leading-snug">{entry.summary}</p>
        {(entry.before || entry.after) && (
          <p className="text-sm text-text-secondary">
            {entry.before && <span>{entry.before}</span>}
            {entry.before && entry.after && <span aria-label={t("log.then")}> → </span>}
            {entry.after && <span className="text-text">{entry.after}</span>}
          </p>
        )}
        <p className="text-xs text-text-secondary">
          {entryTime(entry.at, today)} · {t(`log.actor.${entry.actor}`)} · {t(`log.source.${entry.source}`)}
        </p>
      </div>
      {entry.undone ? (
        <Badge>{t("log.undone")}</Badge>
      ) : canUndo ? (
        <Button size="sm" variant="secondary" icon={<Undo2 size={16} />} onClick={undo}>{t("common.undo")}</Button>
      ) : null}
    </li>
  );
}

/** Everything that changed, newest first, with filters and Undo where it is still possible. */
export function ActivityList() {
  const { state, today } = useStudio();
  const [filter, setFilter] = useState<LogFilter>({});
  const actors = present(state.log, "actor");
  const sources = present(state.log, "source");
  const shown = filterLog(state.log, filter);

  if (!state.log.length) return <EmptyState icon={<History size={22} />} title={t("log.empty")} text={t("log.emptyText")} />;
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("log.filter.who")}>
          <Chip active={!filter.actor} onClick={() => setFilter({ ...filter, actor: undefined })}>{t("log.filter.all")}</Chip>
          {actors.map((actor) => (
            <Chip key={actor} active={filter.actor === actor} onClick={() => setFilter({ ...filter, actor })}>{t(`log.actor.${actor}`)}</Chip>
          ))}
        </div>
        {sources.length > 1 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("log.filter.where")}>
            <Chip active={!filter.source} onClick={() => setFilter({ ...filter, source: undefined })}>{t("log.filter.anywhere")}</Chip>
            {sources.map((source) => (
              <Chip key={source} active={filter.source === source} onClick={() => setFilter({ ...filter, source })}>{t(`log.source.${source}`)}</Chip>
            ))}
          </div>
        )}
      </div>
      {shown.length ? (
        <Card>
          <ul className="divide-y divide-border">
            {shown.map((entry) => (
              <Row key={entry.id} entry={entry} canUndo={isUndoable(state, entry)} today={today} />
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState icon={<History size={22} />} title={t("log.noMatch")} />
      )}
    </div>
  );
}
