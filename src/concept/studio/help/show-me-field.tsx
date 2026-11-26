"use client";

import { useState, type FormEvent } from "react";
import { Eye } from "lucide-react";
import { helpSteps } from "../../help/map/entries";
import { findHelp, type HelpMatch } from "../../help/map/lookup";
import type { HelpEntry } from "../../help/map/types";
import { t, type MessageKey } from "../../i18n";
import { Button } from "../../ui/button";
import { Field, TextInput } from "../../ui/controls";
import { friendlyMessage, FriendlyNotice } from "../../ui/friendly-message";
import { ListRow } from "../../ui/list-row";

/** Places to offer when a question finds nothing. */
const SUGGESTIONS: { label: MessageKey; entry: string }[] = [
  { label: "showMe.suggestion.move", entry: "booking.move" },
  { label: "showMe.suggestion.hours", entry: "hours.weekly" },
  { label: "showMe.suggestion.treatment", entry: "services.add" },
  { label: "showMe.suggestion.share", entry: "link.copy" },
  { label: "showMe.suggestion.pay", entry: "booking.take-payment" },
];

/** The local "Show me" search: no network, so the answer is there as soon as the question is asked. */
export function useShowMeSearch() {
  const [match, setMatch] = useState<HelpMatch | null>(null);
  return { match, find: (question: string) => setMatch(findHelp(question)), clear: () => setMatch(null) };
}

/** The question field at the top of Help. */
export function ShowMeField({ value, onChange, onSubmit, busy }: {
  value: string; onChange: (value: string) => void; onSubmit: (event: FormEvent) => void; busy: boolean;
}) {
  return (
    <form onSubmit={onSubmit} role="search" data-help-id="help.show-me" className="flex flex-wrap items-end gap-2">
      <div className="min-w-0 flex-1 basis-56">
        <Field label={t("showMe.fieldLabel")}>
          <TextInput value={value} onChange={(event) => onChange(event.target.value)} placeholder={t("showMe.placeholder")} maxLength={300} enterKeyHint="search" />
        </Field>
      </div>
      {/* Local lookup does not wait for the article request, so a follow-up question stays available while that loads. */}
      <Button type="submit" icon={<Eye size={18} aria-hidden />} disabled={!value.trim()} aria-busy={busy || undefined}>{t("showMe.submit")}</Button>
    </form>
  );
}

/** "Mer › Inställningar › Avancerat": the way to the place, as the guide will show it. */
function pathText(entry: HelpEntry): string {
  return helpSteps(entry.id).slice(0, -1).map((step) => t(step.label)).join(" › ");
}

function Place({ entry, onShow }: { entry: HelpEntry; onShow: (id: string) => void }) {
  const path = pathText(entry);
  return (
    <ListRow onClick={() => onShow(entry.id)} title={t(entry.label)}
      meta={path || undefined}
      aria-label={`${t("showMe.submit")}: ${t(entry.label)}${path ? `. ${t("showMe.path")}: ${path}` : ""}`}
      trailing={<span className="flex shrink-0 items-center gap-1 text-meta font-medium"><Eye size={16} aria-hidden />{t("showMe.submit")}</span>} />
  );
}

/** The best place, plain choices when the question could mean more than one, or a calm "not found". */
export function ShowMeResult({ match, onShow }: { match: HelpMatch; onShow: (id: string) => void }) {
  if (!match.best) {
    return (
      <FriendlyNotice message={friendlyMessage({ what: "showMe.none", next: "showMe.noneNext" })}
        action={SUGGESTIONS.map((suggestion) => (
          <Button key={suggestion.entry} size="sm" variant="secondary" onClick={() => onShow(suggestion.entry)}>{t(suggestion.label)}</Button>
        ))} />
    );
  }
  const choices = match.ambiguous ? [match.best, ...match.alternatives] : [match.best];
  return (
    <section aria-live="polite" aria-labelledby="show-me-result" className="space-y-1">
      <h3 id="show-me-result" className="text-meta font-semibold text-text-secondary">{t(match.ambiguous ? "showMe.choose" : "showMe.bestMatch")}</h3>
      <div className="divide-y divide-hairline rounded-md bg-surface-2">
        {choices.map((entry) => <Place key={entry.id} entry={entry} onShow={onShow} />)}
      </div>
    </section>
  );
}
