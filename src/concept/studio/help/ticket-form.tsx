"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { summarizeScreen } from "../../help/dom-summary";
import { t, tc } from "../../i18n";
import { buildTicket, TICKET_ACTIVITY } from "../../support/tickets";
import { dispatch } from "../../store";
import { Button } from "../../ui/button";
import { Field, TextArea } from "../../ui/controls";
import { showToast } from "../../ui/toast";
import { useStudio } from "../use-studio";

interface TicketFormProps {
  question: string;
  requestId: string | null;
  onBack: () => void;
  onDone: () => void;
}

/** Shows what a ticket carries, then saves it to the demo's ticket list. */
export function TicketForm({ question, requestId, onBack, onDone }: TicketFormProps) {
  const { state } = useStudio();
  const path = usePathname() ?? "";
  const [text, setText] = useState(question);
  // The outline is taken once, when the form opens, before this window covers the page.
  const [screen] = useState(() => summarizeScreen(document.querySelector("main") ?? document));
  const [id] = useState(() => requestId ?? crypto.randomUUID());

  const save = () => {
    dispatch({ type: "ticket/create", ticket: buildTicket({ question: text, path, requestId: id, screen }, state.log, Date.now()) });
    showToast(t("ticket.saved"));
    onDone();
  };

  const rows: [string, string][] = [
    [t("ticket.page"), path],
    [t("ticket.request"), id],
    [t("ticket.screen"), tc("ticket.lines", screen.length)],
    [t("ticket.activity"), tc("ticket.changes", Math.min(state.log.length, TICKET_ACTIVITY))],
  ];

  return (
    <div className="space-y-4 pt-2">
      <Field label={t("ticket.question")}>
        <TextArea value={text} onChange={(event) => setText(event.target.value)} maxLength={1000} />
      </Field>
      <div className="space-y-1.5">
        <p className="text-sm font-medium">{t("ticket.attached")}</p>
        <dl className="divide-y divide-border rounded-md bg-surface-2 px-3 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-2">
              <dt className="text-text-secondary">{label}</dt>
              <dd className="min-w-0 break-all text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-text-secondary">{t("ticket.demoNote")}</p>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onBack}>{t("common.back")}</Button>
        <Button onClick={save} disabled={!text.trim()}>{t("ticket.send")}</Button>
      </div>
    </div>
  );
}
