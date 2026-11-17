"use client";

import { useState } from "react";
import type { Category, JournalContent } from "../../data/types";
import { t } from "../../i18n";
import { packOf } from "../../packs";
import type { JournalTemplateId } from "../../packs/types";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { Chip, Field, TextArea, TextInput } from "../../ui/controls";
import { useStudio } from "../use-studio";
import { JournalPhotoPicker } from "./journal-photos";

export const BLANK_ENTRY: JournalContent = { treatment: "", observations: "", advice: "" };

function fromTemplate(id: JournalTemplateId): JournalContent {
  return {
    treatment: t(`journal.template.${id}.treatment`),
    observations: t(`journal.template.${id}.observations`),
    advice: t(`journal.template.${id}.advice`),
    nextVisit: t(`journal.template.${id}.nextVisit`),
  };
}

interface JournalFormProps {
  initial: JournalContent;
  /** Show template chips for this kind of customer. Omit when editing an existing entry. */
  templatesFor?: Category | "both";
  onSubmit: (content: JournalContent) => void;
  onCancel: () => void;
}

/** Fields for one journal entry: optional template, text, and before/after photos. */
export function JournalForm({ initial, templatesFor, onSubmit, onCancel }: JournalFormProps) {
  const { state } = useStudio();
  const [form, setForm] = useState<JournalContent>(initial);
  const [template, setTemplate] = useState<JournalTemplateId | null>(null);
  const templates = templatesFor ? packOf(state).journalTemplates.filter((tpl) => templatesFor === "both" || tpl.category === templatesFor) : [];

  return (
    <Card className="space-y-4 p-4">
      {templates.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("journal.template")}</p>
          <div className="flex flex-wrap gap-2">
            {templates.map((tpl) => (
              <Chip
                key={tpl.id}
                active={template === tpl.id}
                onClick={() => {
                  setTemplate(tpl.id);
                  setForm({ ...form, ...fromTemplate(tpl.id) });
                }}
              >
                {t(`journal.template.${tpl.id}.label`)}
              </Chip>
            ))}
          </div>
        </div>
      )}
      <Field label={t("journal.treatment")}>
        <TextInput value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })} />
      </Field>
      <Field label={t("journal.observations")}>
        <TextArea value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} />
      </Field>
      <Field label={t("journal.advice")}>
        <TextArea value={form.advice} onChange={(e) => setForm({ ...form, advice: e.target.value })} />
      </Field>
      <Field label={t("journal.nextVisit")}>
        <TextInput value={form.nextVisit ?? ""} onChange={(e) => setForm({ ...form, nextVisit: e.target.value })} />
      </Field>
      <JournalPhotoPicker value={form.photos ?? {}} onChange={(photos) => setForm({ ...form, photos })} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>{t("common.cancel")}</Button>
        <Button disabled={!form.treatment.trim()} onClick={() => onSubmit(form)}>{t("common.save")}</Button>
      </div>
    </Card>
  );
}
