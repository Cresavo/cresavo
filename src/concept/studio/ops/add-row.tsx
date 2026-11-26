"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { t } from "../../i18n";
import { Button } from "../../ui/button";

interface AddRowProps {
  open: boolean;
  /** Names the form for screen readers; usually the Add button's words. */
  label: string;
  submitLabel: string;
  canSubmit: boolean;
  onSubmit: () => void;
  onClose: () => void;
  /** The Add button: focus goes back to it when the row folds away. */
  trigger: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
}

/**
 * A short new entry that opens at the top of its own list instead of in a sheet: a few fields, Cancel and the verb.
 * It stays mounted so it can fold away, and is inert while closed. Escape cancels. Longer editors keep their sheet.
 */
export function AddRow({ open, label, submitLabel, canSubmit, onSubmit, onClose, trigger, children }: AddRowProps) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (open) form.current?.querySelector<HTMLElement>("input, select, textarea")?.focus();
  }, [open]);
  const close = () => {
    onClose();
    trigger.current?.focus();
  };
  return (
    <div className="ui-reveal" data-open={open || undefined} inert={!open}>
      <div>
        <form ref={form} aria-label={label} className="space-y-4 border-b border-hairline px-4 py-4"
          onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); close(); } }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            onSubmit();
            close();
          }}>
          {children}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={close}>{t("common.cancel")}</Button>
            <Button type="submit" width="responsive" disabled={!canSubmit}>{submitLabel}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
