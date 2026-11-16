"use client";

import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { t } from "../../i18n";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { Field, Segmented, TextInput } from "../../ui/controls";

type Provider = "openrouter" | "openai" | "anthropic";

const PROVIDERS: { value: Provider; label: string }[] = [
  { value: "openrouter", label: "OpenRouter" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
];

/** Demo of "bring your own key". The key is never stored or sent: submitting only clears the field. */
export function OwnKeyForm() {
  const [provider, setProvider] = useState<Provider>("openrouter");
  const [key, setKey] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setKey("");
    setSubmitted(true);
  };

  return (
    <Card className="p-5">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-start gap-3">
          <KeyRound size={20} className="mt-0.5 shrink-0 text-eko-accent" />
          <div className="min-w-0">
            <p className="font-medium">{t("ai.ownKey")}</p>
            <p className="text-sm text-eko-muted">{t("ai.ownKeyText")}</p>
          </div>
        </div>
        <p className="rounded-xl bg-eko-warn-soft px-3.5 py-2.5 text-sm text-eko-warn">{t("ai.ownKeyDemo")}</p>
        <Segmented value={provider} options={PROVIDERS} onChange={setProvider} label={t("ai.provider")} className="w-full" />
        <Field label={t("ai.apiKey")}>
          <TextInput
            type="password"
            autoComplete="off"
            value={key}
            onChange={(event) => {
              setKey(event.target.value);
              setSubmitted(false);
            }}
            placeholder={t("ai.apiKeyPlaceholder")}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!key.trim()}>{t("ai.useKey")}</Button>
          {submitted && <p role="status" className="text-sm text-eko-muted">{t("ai.keyNotStored")}</p>}
        </div>
      </form>
    </Card>
  );
}
