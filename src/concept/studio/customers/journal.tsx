"use client";

import { useState } from "react";
import { Mic, NotebookPen } from "lucide-react";
import type { Customer, JournalContent } from "../../data/types";
import { t } from "../../i18n";
import { dispatch, undo } from "../../store";
import { Button } from "../../ui/button";
import { EmptyState } from "../../ui/empty-state";
import { showToast } from "../../ui/toast";
import { useStudio } from "../use-studio";
import { BLANK_ENTRY, JournalForm } from "./journal-form";
import { JournalEntryCard } from "./journal-entry";
import { JournalDictation } from "./journal-dictation";

/** Journal entries for a customer plus ways to add one: write (with templates and photos) or dictate. */
export function Journal({ customer }: { customer: Customer }) {
  const { state, today } = useStudio();
  const entries = state.journals.filter((j) => j.customerId === customer.id).sort((a, b) => b.date.localeCompare(a.date));
  const [writing, setWriting] = useState(false);
  const [dictating, setDictating] = useState(false);

  const save = (content: JournalContent) => {
    dispatch({ type: "journal/add", entry: { customerId: customer.id, date: today, staffId: customer.preferredStaff, ...content, nextVisit: content.nextVisit?.trim() || undefined } });
    showToast(t("journal.saved"), { label: t("common.undo"), run: undo });
    setWriting(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button icon={<NotebookPen size={18} />} onClick={() => { setWriting(!writing); setDictating(false); }}>{t("journal.write")}</Button>
        <Button variant="secondary" icon={<Mic size={18} />} onClick={() => { setDictating(true); setWriting(false); }}>
          {t("journal.dictate")}
        </Button>
      </div>
      {dictating && <JournalDictation customer={customer} onClose={() => setDictating(false)} />}
      {writing && <JournalForm initial={BLANK_ENTRY} templatesFor={customer.category} onSubmit={save} onCancel={() => setWriting(false)} />}
      {entries.length ? (
        entries.map((entry) => <JournalEntryCard key={entry.id} entry={entry} />)
      ) : (
        <EmptyState icon={<NotebookPen size={22} />} title={t("journal.empty")} text={t("journal.emptyText")} />
      )}
    </div>
  );
}
