"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { defaultPrefill, draftLink, newDraft, resolvePoster, type Draft } from "../../campaigns/draft";
import { prefillFromQuery } from "../../campaigns/prefill";
import { addDays } from "../../data/dates";
import type { DateKey } from "../../data/types";
import { t } from "../../i18n";
import { currentState, dispatch, undo } from "../../store";
import { Button } from "../../ui/button";
import { cx } from "../../ui/cx";
import { showToast } from "../../ui/toast";
import { BackLink } from "../back-link";
import { PageHeader } from "../page-header";
import { useStudio } from "../use-studio";
import { OfferStep } from "./offer-step";
import { PosterStep } from "./poster-step";
import { PublishStep } from "./publish-step";
import { TextsStep } from "./texts-step";

const STEPS = ["offer", "texts", "poster", "publish"] as const;
type Step = (typeof STEPS)[number];

/** From offer to published campaign in four short steps. Opens filled in from a holiday, an offer or a command. */
export function CampaignStudio() {
  const { state, today } = useStudio();
  const router = useRouter();
  const query = useSearchParams();
  const [draft, setDraft] = useState<Draft>(() => newDraft((query && prefillFromQuery(query, state, today)) ?? defaultPrefill(state, today)));
  const [step, setStep] = useState<Step>("offer");
  const index = STEPS.indexOf(step);
  const change = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  const publish = (publishOn: DateKey) => {
    const ok = dispatch({
      type: "campaign/launch",
      today,
      campaign: {
        name: draft.name.trim(),
        serviceIds: draft.serviceIds,
        discountPercent: draft.discountPercent,
        from: draft.from,
        to: draft.to,
        channels: draft.channels,
        holidayId: draft.holidayId,
        publishOn,
        copy: draft.copy,
        poster: resolvePoster(state, draft),
        link: draftLink(draft),
      },
    });
    const created = currentState()?.campaigns[0];
    if (!ok || !created) return showToast(t("command.failed"));
    showToast(publishOn <= today ? t("campaigns.publish.done", { name: created.name }) : t("campaigns.publish.scheduled", { name: created.name }), { label: t("common.undo"), run: undo });
    router.push(`/studio/more/campaigns/${created.id}`);
  };

  return (
    <>
      <PageHeader
        title={t("campaigns.studio.title")}
        subtitle={t("campaigns.studio.subtitle")}
        back={<BackLink href="/studio/more/campaigns" label={t("nav.campaigns")} />}
      />
      <ol className="mb-6 flex gap-1.5 overflow-x-auto" aria-label={t("campaigns.studio.steps")}>
        {STEPS.map((name, i) => (
          <li key={name} className="min-w-0 flex-1">
            <button
              aria-current={i === index ? "step" : undefined}
              disabled={i > index}
              onClick={() => setStep(name)}
              className={cx(
                "flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-medium",
                i === index ? "bg-eko-accent text-eko-on-accent" : i < index ? "bg-eko-accent-soft text-eko-accent" : "bg-eko-sunken text-eko-muted",
              )}
            >
              {i < index ? <Check size={15} /> : <span className="tabular-nums">{i + 1}</span>}
              <span className={i === index ? "" : "hidden sm:inline"}>{t(`campaigns.step.${name}`)}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="pb-6">
        {step === "offer" && <OfferStep state={state} today={today} draft={draft} onChange={change} />}
        {step === "texts" && <TextsStep state={state} draft={draft} onChange={change} />}
        {step === "poster" && <PosterStep state={state} draft={draft} onChange={change} />}
        {step === "publish" && (
          <PublishStep
            state={state}
            today={today}
            draft={draft}
            scheduleDefault={draft.from > today ? draft.from : addDays(today, 1)}
            onChange={change}
            onPublish={publish}
          />
        )}
      </div>

      {step !== "publish" && (
        <div className="flex gap-2 border-t border-eko-line pt-4">
          {index > 0 && (
            <Button variant="secondary" size="lg" icon={<ArrowLeft size={18} />} onClick={() => setStep(STEPS[index - 1])}>
              {t("common.back")}
            </Button>
          )}
          <Button size="lg" className="flex-1" disabled={!draft.name.trim()} onClick={() => setStep(STEPS[index + 1])}>
            {t(`campaigns.next.${STEPS[index + 1] as "texts" | "poster" | "publish"}`)}
            <ArrowRight size={18} />
          </Button>
        </div>
      )}
      {step === "publish" && (
        <div className="border-t border-eko-line pt-4">
          <Button variant="secondary" size="lg" icon={<ArrowLeft size={18} />} onClick={() => setStep("poster")}>{t("common.back")}</Button>
        </div>
      )}
    </>
  );
}
