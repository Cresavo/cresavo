"use client";

import { useId, useState } from "react";
import { ArrowRight } from "lucide-react";
import { t } from "../i18n";
import { Button, IconButton } from "../ui/button";
import { SearchInput } from "../ui/controls";

interface AskStepProps {
  onAsk: (text: string) => void;
  /** Shown when the page has no price list to pick from. */
  onChoose?: () => void;
}

/**
 * The quiet way in: one line where a customer can say what they want in their own words.
 * The price list is the main way to book, so this is a field, not a block.
 */
export function AskStep({ onAsk, onChoose }: AskStepProps) {
  const [text, setText] = useState("");
  const hint = useId();
  return (
    <div className="space-y-2">
      <form
        role="search"
        className="space-y-1"
        onSubmit={(event) => {
          event.preventDefault();
          if (text.trim()) onAsk(text);
        }}
      >
        <SearchInput
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label={t("booking.ask.title")}
          aria-describedby={hint}
          placeholder={t("booking.ask.placeholder")}
          enterKeyHint="search"
          autoComplete="off"
          endAction={text.trim() && (
            <IconButton type="submit" variant="primary" label={t("booking.ask.submit")}>
              <ArrowRight size={18} aria-hidden />
            </IconButton>
          )}
        />
        <p id={hint} className="text-meta text-text-secondary">{t("booking.ask.hint")}</p>
      </form>
      {onChoose && (
        <Button variant="tertiary" onClick={onChoose}>
          {t("booking.ask.classic")}
        </Button>
      )}
    </div>
  );
}
