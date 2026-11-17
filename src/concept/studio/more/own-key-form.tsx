"use client";

import { useEffect, useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { t } from "../../i18n";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { Field, Segmented, TextInput } from "../../ui/controls";

import { fetchAiOverview, saveAiSettings } from "../../ai/api-client";
import type { AiOverview } from "../../ai/overview";

type Provider = "openrouter" | "openai" | "anthropic";

const PROVIDERS: { value: Provider; label: string }[] = [
  { value: "openrouter", label: "OpenRouter" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
];

/** Only masked metadata comes back from the encrypted server store. */
export function OwnKeyForm() {
  const [provider, setProvider] = useState<Provider>("openrouter");
  const [key, setKey] = useState("");
  const [overview, setOverview] = useState<AiOverview>();
  const [status, setStatus] = useState<"saved" | "failed" | "removed" | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetchAiOverview().then(setOverview, () => setStatus("failed")); }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const submittedKey = key.trim();
    setKey("");
    setBusy(true);
    try { setOverview(await saveAiSettings({ provider, key: submittedKey })); setStatus("saved"); }
    catch { setStatus("failed"); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { setOverview(await saveAiSettings(null)); setStatus("removed"); }
    catch { setStatus("failed"); }
    finally { setBusy(false); }
  };

  return (
    <Card className="p-5">
      {overview?.ownKey && <div className="mb-4 flex flex-wrap items-center gap-3">
        <p>{overview.ownKey.provider} · ••••{overview.ownKey.last4}</p>
        {!overview.ownKey.usable && <p className="text-sm text-warning">{t("ai.keyLocked")}</p>}
        <Button variant="secondary" disabled={busy} onClick={remove}>{t("ai.removeKey")}</Button>
      </div>}
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-start gap-3">
          <KeyRound size={20} className="mt-0.5 shrink-0 text-action" />
          <div className="min-w-0">
            <p className="font-medium">{t("ai.ownKey")}</p>
            <p className="text-sm text-text-secondary">{t("ai.ownKeyText")}</p>
          </div>
        </div>
        <p className="rounded-md bg-warning-bg px-3.5 py-2.5 text-sm text-warning">{t(overview?.keyStorageAvailable ? "ai.ownKeyDemo" : "ai.keyStorageUnavailable")}</p>
        <Segmented value={provider} options={PROVIDERS} onChange={setProvider} label={t("ai.provider")} className="w-full" />
        <Field label={t("ai.apiKey")}>
          <TextInput
            type="password"
            autoComplete="off"
            value={key}
            onChange={(event) => {
              setKey(event.target.value);
              setStatus(null);
            }}
            placeholder={t("ai.apiKeyPlaceholder")}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!overview?.keyStorageAvailable || key.trim().length < 8 || busy}>{t("ai.useKey")}</Button>
          {status && <p role="status" className="text-sm text-text-secondary">{t(`ai.key.${status}`)}</p>}
        </div>
      </form>
    </Card>
  );
}
