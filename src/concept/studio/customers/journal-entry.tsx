"use client";

import { useState } from "react";
import { History, Pencil } from "lucide-react";
import type { JournalContent, JournalEntry as Entry } from "../../data/types";
import { t, tc } from "../../i18n";
import { formatDate } from "../../i18n/format";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { showToast } from "../../ui/toast";
import { useStudio } from "../use-studio";
import { JournalForm } from "./journal-form";
import { JournalPhotoPair } from "./journal-photos";
import { dispatchWithUndoToast } from "../log/undo-toast";

/** One journal entry. Edits keep the earlier wording under "Earlier versions". */
export function JournalEntryCard({ entry }: { entry: Entry }) {
  const { state, today } = useStudio();
  const [editing, setEditing] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const versions = entry.versions ?? [];

  if (editing) {
    const save = (content: JournalContent) => {
      if (!dispatchWithUndoToast({ type: "journal/edit", id: entry.id, content, on: today }, t("journal.edited"))) {
        showToast(t("journal.unchanged"));
      }
      setEditing(false);
    };
    return <JournalForm initial={entry} onSubmit={save} onCancel={() => setEditing(false)} />;
  }

  return (
    <Card className="space-y-3 p-4 text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold">{formatDate(entry.date)}</p>
        <div className="flex items-center gap-1">
          <p className="text-text-secondary">{state.staff.find((s) => s.id === entry.staffId)?.firstName}</p>
          <Button size="sm" variant="ghost" icon={<Pencil size={14} />} aria-label={`${t("journal.edit")} ${formatDate(entry.date)}`} onClick={() => setEditing(true)}>
            {t("journal.edit")}
          </Button>
        </div>
      </div>
      <EntryText content={entry} />
      <JournalPhotoPair photos={entry.photos} />
      {versions.length > 0 && (
        <div className="space-y-3 border-t border-hairline pt-3">
          <Button size="sm" variant="ghost" icon={<History size={14} />} aria-expanded={showVersions} className="-ml-3" onClick={() => setShowVersions(!showVersions)}>
            {tc("journal.versions", versions.length)}
          </Button>
          {showVersions && (
            <div className="space-y-3">
              <p className="text-xs text-text-secondary">{t("journal.versionsHint")}</p>
              {[...versions].reverse().map((version, index) => (
                <div key={index} className="space-y-2 rounded-md bg-surface-2 p-3">
                  <p className="text-xs font-semibold text-text-secondary">{t("journal.versionReplaced", { date: formatDate(version.replacedOn) })}</p>
                  <EntryText content={version} />
                  <JournalPhotoPair photos={version.photos} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function EntryText({ content }: { content: JournalContent }) {
  return (
    <>
      <JournalLine label={t("journal.treatment")} text={content.treatment} />
      <JournalLine label={t("journal.observations")} text={content.observations} />
      <JournalLine label={t("journal.advice")} text={content.advice} />
      {content.nextVisit && <JournalLine label={t("journal.nextVisit")} text={content.nextVisit} />}
    </>
  );
}

function JournalLine({ label, text }: { label: string; text: string }) {
  if (!text) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</p>
      <p className="mt-1 whitespace-pre-line leading-relaxed">{text}</p>
    </div>
  );
}
