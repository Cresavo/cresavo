"use client";

import { useState } from "react";
import { Mic, NotebookPen } from "lucide-react";
import type { Customer, JournalContent } from "../../data/types";
import { t } from "../../i18n";
import { Button } from "../../ui/button";
import { EmptyState } from "../../ui/empty-state";
import { StatusDot } from "../../ui/feedback";
import { useStudio } from "../use-studio";
import { BLANK_ENTRY, JournalForm } from "./journal-form";
import { JournalEntryCard } from "./journal-entry";
import { JournalDictation } from "./journal-dictation";
import { dispatchWithUndoToast } from "../log/undo-toast";
import type { ShownJournal } from "./use-server-journal";

/**
 * Journal entries for a customer plus ways to add one: write (with templates and photos) or dictate. `journal` is
 * the page's copy with the text the server keeps (`useServerJournal`); without it the salon's own entries are shown.
 */
export function Journal({ customer, journal }: { customer: Customer; journal?: ShownJournal }) {
  const { state, today } = useStudio();
  const entries = [...(journal?.entries ?? state.journals.filter((j) => j.customerId === customer.id))].sort((a, b) => b.date.localeCompare(a.date));
  const [writing, setWriting] = useState(false);
  const [dictating, setDictating] = useState(false);

  const save = (content: JournalContent) => {
    dispatchWithUndoToast({ type: "journal/add", entry: { customerId: customer.id, date: today, staffId: customer.preferredStaff, ...content, nextVisit: content.nextVisit?.trim() || undefined } }, t("journal.saved"));
    setWriting(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" icon={<NotebookPen size={18} />} onClick={() => { setWriting(!writing); setDictating(false); }}>{t("journal.write")}</Button>
        <Button variant="secondary" icon={<Mic size={18} />} onClick={() => { setDictating(true); setWriting(false); }}>
          {t("journal.dictate")}
        </Button>
      </div>
      {dictating && <JournalDictation customer={customer} onClose={() => setDictating(false)} />}
      {writing && <JournalForm initial={BLANK_ENTRY} templatesFor={customer.category} onSubmit={save} onCancel={() => setWriting(false)} />}
      {journal?.loading && <p role="status" className="flex items-center gap-2 text-meta text-text-secondary"><StatusDot />{t("journal.loading")}</p>}
      {journal?.failed && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-meta text-text-secondary">
          <span>{t("journal.loadFailed")}</span>
          <Button size="sm" variant="secondary" onClick={journal.retry}>{t("journal.retry")}</Button>
        </div>
      )}
      {entries.length ? (
        entries.map((entry) => <JournalEntryCard key={entry.id} entry={entry} />)
      ) : journal?.loading || journal?.failed ? null : (
        <EmptyState icon={<NotebookPen size={22} />} title={t("journal.empty")} text={t("journal.emptyText")} />
      )}
    </div>
  );
}
