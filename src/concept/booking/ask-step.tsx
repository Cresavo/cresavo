"use client";

import { useState } from "react";
import { ListChecks, Search } from "lucide-react";
import { t } from "../i18n";
import { Button } from "../ui/button";
import { TextInput } from "../ui/controls";

const EXAMPLES = ["booking.example.1", "booking.example.2", "booking.example.3"] as const;

interface AskStepProps {
  /** Names of three services the examples are built around. */
  services: [string, string, string];
  onAsk: (text: string) => void;
  onChoose: () => void;
}

/** The box at the top of the page: say what you want in your own words, or pick from the list. */
export function AskStep({ services, onAsk, onChoose }: AskStepProps) {
  const [text, setText] = useState("");
  const examples = EXAMPLES.map((key, i) => ({ key, text: t(key, { service: services[i] }) }));
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{t("booking.ask.title")}</h2>
        <p className="mt-1 text-[15px] text-text-secondary">{t("booking.ask.help")}</p>
      </div>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (text.trim()) onAsk(text);
        }}
      >
        <TextInput
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label={t("booking.ask.title")}
          placeholder={t("booking.ask.placeholder", { service: services[0] })}
          enterKeyHint="search"
          autoComplete="off"
          className="min-h-12 text-base"
        />
        <Button type="submit" size="lg" className="w-full" icon={<Search size={18} />} disabled={!text.trim()}>
          {t("booking.ask.submit")}
        </Button>
      </form>
      <div className="flex flex-wrap gap-2" aria-label={t("booking.ask.examples")}>
        {examples.map((example) => (
          <button
            key={example.key}
            onClick={() => onAsk(example.text)}
            className="min-h-10 rounded-full bg-surface-2 px-3.5 text-left text-sm text-text transition-colors hover:bg-action-bg"
          >
            {example.text}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 text-xs text-text-secondary">
        <span className="h-px flex-1 bg-border" />
        {t("booking.ask.or")}
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button variant="secondary" size="lg" className="w-full" icon={<ListChecks size={18} />} onClick={onChoose}>
        {t("booking.ask.classic")}
      </Button>
    </div>
  );
}
