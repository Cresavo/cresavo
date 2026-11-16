"use client";

import { useState } from "react";
import type { Customer } from "../../data/types";
import { t } from "../../i18n";
import { dispatch, undo } from "../../store";
import { Button } from "../../ui/button";
import { TextArea } from "../../ui/controls";
import { showToast } from "../../ui/toast";

/** Free-text note about the customer, shown before every visit. */
export function Notes({ customer }: { customer: Customer }) {
  const [text, setText] = useState(customer.note ?? "");
  const changed = text !== (customer.note ?? "");
  return (
    <div className="space-y-2">
      <TextArea value={text} onChange={(e) => setText(e.target.value)} placeholder={t("notes.placeholder")} aria-label={t("notes.title")} />
      {changed && (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setText(customer.note ?? "")}>{t("common.cancel")}</Button>
          <Button
            size="sm"
            onClick={() => {
              dispatch({ type: "customer/note", id: customer.id, note: text.trim() });
              showToast(t("notes.saved"), { label: t("common.undo"), run: undo });
            }}
          >
            {t("common.save")}
          </Button>
        </div>
      )}
    </div>
  );
}
