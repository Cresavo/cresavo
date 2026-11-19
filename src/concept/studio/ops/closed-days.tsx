"use client";

import { useState } from "react";
import { CalendarOff, Plus, X } from "lucide-react";
import { t } from "../../i18n";
import { formatDayLong } from "../../i18n/format";
import { closureSuggestions } from "../../ops/holidays";
import { Button, IconButton } from "../../ui/button";
import { Card, Section } from "../../ui/card";
import { Chip, Field, TextInput } from "../../ui/controls";
import { Sheet } from "../../ui/sheet";
import { useStudio } from "../use-studio";
import { dispatchWithUndoToast } from "../log/undo-toast";

/** Days the salon is closed on top of the weekly hours, with the Swedish holidays as suggestions. */
export function ClosedDaysSection() {
  const { state, today } = useStudio();
  const [adding, setAdding] = useState(false);
  const upcoming = state.salon.closures.filter((c) => c.date >= today);
  return (
    <Section
      title={t("closed.title")}
      action={<Button size="sm" variant="secondary" icon={<Plus size={16} />} onClick={() => setAdding(true)}>{t("closed.add")}</Button>}
    >
      <Card className="divide-y divide-hairline">
        {upcoming.length ? (
          upcoming.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <CalendarOff size={16} className="shrink-0 text-text-secondary" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{formatDayLong(c.date)}</span>
                <span className="block truncate text-text-secondary">{c.name}</span>
              </span>
              <IconButton
                label={t("closed.reopen", { day: formatDayLong(c.date) })}
                className="size-9"
                onClick={() => {
                  dispatchWithUndoToast({ type: "salon/reopen", id: c.id }, t("closed.reopened"));
                }}
              >
                <X size={16} />
              </IconButton>
            </div>
          ))
        ) : (
          <p className="px-4 py-4 text-sm text-text-secondary">{t("closed.none")}</p>
        )}
      </Card>
      {adding && <CloseSheet onClose={() => setAdding(false)} />}
    </Section>
  );
}

function CloseSheet({ onClose }: { onClose: () => void }) {
  const { state, today } = useStudio();
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const suggestions = closureSuggestions(state.salon, today).filter((h) => !state.salon.closures.some((c) => c.date === h.date));
  const save = () => {
    dispatchWithUndoToast({ type: "salon/close", date, name }, t("closed.saved", { day: formatDayLong(date) }));
    onClose();
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title={t("closed.add")}
      description={t("closed.addText")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={!date || !name.trim()} onClick={save}>{t("common.save")}</Button>
        </>
      }
    >
      <div className="space-y-5">
        {suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("closed.suggestions")}</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((h) => (
                <Chip key={h.date} active={date === h.date} onClick={() => { setDate(h.date); setName(t(h.name)); }}>
                  {t(h.name)} · {formatDayLong(h.date)}
                </Chip>
              ))}
            </div>
          </div>
        )}
        <Field label={t("closed.date")}>
          <TextInput type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={t("closed.name")}>
          <TextInput value={name} maxLength={60} placeholder={t("closed.namePlaceholder")} onChange={(e) => setName(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}
