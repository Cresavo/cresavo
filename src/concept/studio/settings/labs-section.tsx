"use client";

import { useEffect, useState } from "react";
import { getActiveLocale, t } from "../../i18n";
import { localSpeechStatus, probeLocalSpeech, useSpeechSupported, type LocalSpeechAvailability } from "../../command/use-speech";
import { setLabFlag, useLabFlag } from "../../labs/flags";
import { useRole } from "../../ops/role";
import { Card, Section } from "../../ui/card";
import { Switch } from "../../ui/controls";
import { useStudio } from "../use-studio";

/** Early tools the owner switches on in this browser. Off until switched on; not an add-on and not priced. */
export function LabsSection() {
  const { state } = useStudio();
  const role = useRole();
  const voice = useLabFlag("voiceAssistant");
  const canListen = useSpeechSupported();
  const [local, setLocal] = useState<LocalSpeechAvailability | null>(() => localSpeechStatus(getActiveLocale()));
  useEffect(() => {
    let alive = true;
    void probeLocalSpeech(getActiveLocale()).then((status) => {
      if (alive) setLocal(status);
    });
    return () => {
      alive = false;
    };
  }, []);
  if (role !== "owner") return null;
  // Only promise on-device recognition when the language pack is already there.
  const hint = !canListen ? t("labs.voice.unsupported") : !state.modules.assistant ? t("labs.voice.needsAssistant") : local === "available" ? t("labs.voice.onDevice") : t("labs.voice.online");
  return (
    <Section title={t("labs.title")}>
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-body font-medium">{t("labs.voice.title")}</span>
            <span className="block text-sm text-text-secondary">{t("labs.voice.text")}</span>
            {voice && <span className="mt-1 block text-sm text-text-secondary">{hint}</span>}
          </span>
          <Switch checked={voice} onChange={() => setLabFlag("voiceAssistant", !voice)} label={t("labs.voice.title")} />
        </div>
      </Card>
    </Section>
  );
}
