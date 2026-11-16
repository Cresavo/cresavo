"use client";

import { useState } from "react";
import { Mic, Sparkles } from "lucide-react";
import { t } from "../i18n";
import { showToast } from "../ui/toast";

/**
 * Placeholder for the command box ("What would you like to do?") that sits at
 * the top of every studio page. The next build step replaces the submit
 * handler with the intent parser and suggestion cards; keep the props-free API.
 */
export function CommandSlot() {
  const [text, setText] = useState("");
  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        showToast(t("command.comingSoon"));
        setText("");
      }}
      className="flex min-h-12 items-center gap-2 rounded-2xl bg-eko-surface pl-4 pr-1.5 shadow-card ring-1 ring-eko-line/70 focus-within:ring-2 focus-within:ring-eko-accent"
    >
      <Sparkles size={18} className="shrink-0 text-eko-accent" />
      <input
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={t("command.placeholder")}
        aria-label={t("command.label")}
        className="min-w-0 flex-1 bg-transparent py-3 text-[15px] placeholder:text-eko-muted focus:outline-none"
      />
      <button
        type="button"
        aria-label={t("command.voice")}
        title={t("command.voice")}
        onClick={() => showToast(t("command.comingSoon"))}
        className="flex size-9 items-center justify-center rounded-xl text-eko-muted hover:bg-eko-sunken hover:text-eko-ink"
      >
        <Mic size={18} />
      </button>
    </form>
  );
}
