"use client";

import { useState } from "react";
import type { Customer } from "../../data/types";
import { t } from "../../i18n";
import { Button } from "../../ui/button";
import { TextArea } from "../../ui/controls";
import { dispatchWithUndoToast } from "../log/undo-toast";

/** Free-text note about the customer, shown before every visit. */
export function Notes({ customer }: { customer: Customer }) {
  const [text, setText] = useState(customer.note ?? "");
  const changed = text !== (customer.note ?? "");
  return (
    <div className="space-y-2 md:max-w-form">
      <TextArea value={text} onChange={(e) => setText(e.target.value)} placeholder={t("notes.placeholder")} aria-label={t("notes.title")} />
      {changed && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setText(customer.note ?? "")}>{t("common.cancel")}</Button>
          <Button variant="secondary" width="responsive"
            size="sm"
            onClick={() => {
              dispatchWithUndoToast({ type: "customer/note", id: customer.id, note: text.trim() }, t("notes.saved"));
            }}
          >
            {t("common.save")}
          </Button>
        </div>
      )}
    </div>
  );
}
