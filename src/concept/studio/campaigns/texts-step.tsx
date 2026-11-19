import { useEffect, useRef } from "react";
import { RefreshCw } from "lucide-react";
import { isAiConfigured, runAiTask } from "../../ai/api-client";
import { assembleCopy, CHANNEL_LIMIT, CHANNELS, isOverLimit } from "../../campaigns/channels";
import { rulesCopy } from "../../campaigns/copy";
import { draftLink, draftOffer, offerSignature, type Draft } from "../../campaigns/draft";
import type { Channel, DemoState } from "../../data/types";
import { t } from "../../i18n";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { cx } from "../../ui/cx";
import { TextArea } from "../../ui/controls";

interface TextsStepProps {
  state: DemoState;
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
}

/** Step 2: one text per channel. Rules write them at once; an AI draft replaces a text the owner has not touched. */
export function TextsStep({ state, draft, onChange }: TextsStepProps) {
  const latest = useRef(draft);
  useEffect(() => {
    latest.current = draft;
  });
  const language = state.localization.language;
  const signature = offerSignature(state, draft);

  useEffect(() => {
    const current = latest.current;
    if (current.copyFor === signature) return;
    const offer = draftOffer(state, current);
    const link = draftLink(current);
    const copy = Object.fromEntries(CHANNELS.map((channel) => [channel, rulesCopy(channel, offer, link, language)])) as Record<Channel, string>;
    onChange({ copy, copyFor: signature });
    let cancelled = false;
    void isAiConfigured().then((ready) => {
      if (!ready) return;
      for (const channel of CHANNELS) {
        runAiTask<{ text: string; hashtags: string[] }>("write-post", { offer, channel, locale: language })
          .then(({ output, log }) => {
            const now = latest.current;
            if (cancelled || log.source !== "ai" || now.copyFor !== signature || now.copy[channel] !== copy[channel]) return;
            onChange({ copy: { ...now.copy, [channel]: assembleCopy(channel, output.text, output.hashtags, link, language) } });
          })
          .catch(() => undefined);
      }
    });
    return () => {
      cancelled = true;
    };
    // The texts depend on the offer only; `state` and `onChange` change identity on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const rewrite = () => {
    const offer = draftOffer(state, draft);
    const link = draftLink(draft);
    onChange({ copy: Object.fromEntries(CHANNELS.map((channel) => [channel, rulesCopy(channel, offer, link, language)])), copyFor: signature });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">{t("campaigns.texts.hint")}</p>
        <Button variant="ghost" size="sm" icon={<RefreshCw size={15} />} onClick={rewrite}>{t("campaigns.texts.rewrite")}</Button>
      </div>
      {CHANNELS.map((channel) => {
        const text = draft.copy[channel] ?? "";
        const over = isOverLimit(channel, text);
        return (
          <Card key={channel} className="space-y-2 p-4">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor={`copy-${channel}`} className="font-medium">{t(`channel.${channel}`)}</label>
              <span className={cx("text-xs tabular-nums", over ? "font-semibold text-danger" : "text-text-secondary")}>
                {text.length} / {CHANNEL_LIMIT[channel]}
              </span>
            </div>
            <TextArea
              id={`copy-${channel}`}
              value={text}
              rows={channel === "sms" ? 4 : 5}
              onChange={(event) => onChange({ copy: { ...draft.copy, [channel]: event.target.value } })}
            />
          </Card>
        );
      })}
    </div>
  );
}
