"use client";

import { useRef, useState } from "react";
import { CalendarOff, Plus, X } from "lucide-react";
import { t } from "../../i18n";
import { formatDayLong } from "../../i18n/format";
import { closureSuggestions } from "../../ops/holidays";
import { Button, IconButton } from "../../ui/button";
import { Card, Section } from "../../ui/card";
import { Chip, Field, TextInput } from "../../ui/controls";
import { useStudio } from "../use-studio";
import { dispatchWithUndoToast } from "../log/undo-toast";
import { AddRow } from "./add-row";

/** Days the salon is closed on top of the weekly hours, with the Swedish holidays as suggestions. A new day is added in the list. */
export function ClosedDaysSection() {
  const { state, today } = useStudio();
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const addButton = useRef<HTMLButtonElement>(null);
  const upcoming = state.salon.closures.filter((c) => c.date >= today);
  const suggestions = closureSuggestions(state.salon, today).filter((h) => !state.salon.closures.some((c) => c.date === h.date));
  const close = () => {
    setAdding(false);
    setDate("");
    setName("");
  };
  return (
    <Section
      title={t("closed.title")}
      action={<Button data-help-id="hours.closed-days" ref={addButton} size="sm" variant="secondary" icon={<Plus size={16} />} aria-expanded={adding} onClick={() => (adding ? close() : setAdding(true))}>{t("closed.add")}</Button>}
    >
      <Card>
        <AddRow open={adding} label={t("closed.add")} submitLabel={t("common.save")} canSubmit={!!date && !!name.trim()} trigger={addButton} onClose={close}
          onSubmit={() => dispatchWithUndoToast({ type: "salon/close", date, name }, t("closed.saved", { day: formatDayLong(date) }))}>
          <p className="text-sm text-text-secondary">{t("closed.addText")}</p>
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
          <div className="flex flex-wrap gap-4">
            <Field width="date" label={t("closed.date")}>
              <TextInput type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field width="short" label={t("closed.name")}>
              <TextInput value={name} maxLength={60} placeholder={t("closed.namePlaceholder")} onChange={(e) => setName(e.target.value)} />
            </Field>
          </div>
        </AddRow>
        <div className="divide-y divide-hairline">
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
        </div>
      </Card>
    </Section>
  );
}
