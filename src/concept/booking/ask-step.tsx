"use client";

import { useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { t } from "../i18n";

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
  return (
    <div className="space-y-2">
      <form
        role="search"
        className="relative"
        onSubmit={(event) => {
          event.preventDefault();
          if (text.trim()) onAsk(text);
        }}
      >
        <Search aria-hidden size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label={t("booking.ask.title")}
          placeholder={t("booking.ask.placeholder")}
          enterKeyHint="search"
          autoComplete="off"
          className="min-h-12 w-full rounded-md bg-surface py-2.5 pl-10 pr-12 text-base ring-1 ring-inset ring-hairline placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-focus"
        />
        {text.trim() && (
          <button type="submit" aria-label={t("booking.ask.submit")} className="absolute right-0.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-sm bg-action text-on-action">
            <ArrowRight size={18} />
          </button>
        )}
      </form>
      {onChoose && (
        <button type="button" onClick={onChoose} className="min-h-11 text-sm font-medium text-action underline-offset-2 hover:underline">
          {t("booking.ask.classic")}
        </button>
      )}
    </div>
  );
}
