"use client";

import { useState } from "react";
import { Mic, NotebookPen } from "lucide-react";
import type { Customer, StaffId } from "../../data/types";
import { t } from "../../i18n";
import { formatDate } from "../../i18n/format";
import { dispatch, undo } from "../../store";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { Field, TextArea, TextInput } from "../../ui/controls";
import { EmptyState } from "../../ui/empty-state";
import { showToast } from "../../ui/toast";
import { useStudio } from "../use-studio";
import { JournalDictation } from "./journal-dictation";

/** Journal entries for a customer plus a short form to add one. */
export function Journal({ customer }: { customer: Customer }) {
  const { state, today } = useStudio();
  const entries = state.journals.filter((j) => j.customerId === customer.id).sort((a, b) => b.date.localeCompare(a.date));
  const [form, setForm] = useState({ treatment: "", observations: "", advice: "" });
  const [writing, setWriting] = useState(false);
  const [dictating, setDictating] = useState(false);
  const staffId: StaffId = customer.preferredStaff;

  const save = () => {
    dispatch({ type: "journal/add", entry: { customerId: customer.id, date: today, staffId, ...form } });
    showToast(t("journal.saved"), { label: t("common.undo"), run: undo });
    setForm({ treatment: "", observations: "", advice: "" });
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
      {writing && (
        <Card className="space-y-4 p-4">
          <Field label={t("journal.treatment")}>
            <TextInput value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })} />
          </Field>
          <Field label={t("journal.observations")}>
            <TextArea value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} />
          </Field>
          <Field label={t("journal.advice")}>
            <TextArea value={form.advice} onChange={(e) => setForm({ ...form, advice: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setWriting(false)}>{t("common.cancel")}</Button>
            <Button disabled={!form.treatment.trim()} onClick={save}>{t("common.save")}</Button>
          </div>
        </Card>
      )}
      {entries.length ? (
        entries.map((j) => (
          <Card key={j.id} className="space-y-3 p-4 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-semibold">{formatDate(j.date)}</p>
              <p className="text-eko-muted">{state.staff.find((s) => s.id === j.staffId)?.firstName}</p>
            </div>
            <JournalLine label={t("journal.treatment")} text={j.treatment} />
            <JournalLine label={t("journal.observations")} text={j.observations} />
            <JournalLine label={t("journal.advice")} text={j.advice} />
            {j.nextVisit && <JournalLine label={t("journal.nextVisit")} text={j.nextVisit} />}
          </Card>
        ))
      ) : (
        <EmptyState icon={<NotebookPen size={22} />} title={t("journal.empty")} text={t("journal.emptyText")} />
      )}
    </div>
  );
}

function JournalLine({ label, text }: { label: string; text: string }) {
  if (!text) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-eko-muted">{label}</p>
      <p className="mt-0.5 leading-relaxed">{text}</p>
    </div>
  );
}
