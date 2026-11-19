"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Globe, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { bookingHome } from "../../booking/links";
import { getActiveLocale, t } from "../../i18n";
import { SETUP_TYPES, salonDraft, suggestedSlug, suggestedTreatments, treatmentsValid, type SalonDraft, type SetupType } from "../../onboarding/salon";
import { useSetupProgress } from "./progress";
import { switchSalon, useWorkspaceSlug } from "../../store";
import { showToast } from "../../ui/toast";
import { Button, ButtonLink, IconButton, buttonClass } from "../../ui/button";
import { ChoiceCards, Field, TextInput } from "../../ui/controls";
import { useStudio } from "../use-studio";
import { recordPageSeen } from "./checklist";
import { SalonEntry } from "./entry";
import { ReturnToDemo } from "./trial-notice";
import { SetupTreatments } from "./treatments";

/** Name and type, then treatments; the third screen is the finished salon. */
const STEPS = ["identity", "treatments"] as const;
const TOTAL = STEPS.length + 1;

function SetupProgress({ number }: { number: number }) {
  return (
    <header className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-meta font-medium"><span>{t("setup.title")}</span><span className="text-text-secondary">{t("setup.step", { step: number, total: TOTAL })}</span></div>
      <progress aria-label={t("setup.title")} value={number} max={TOTAL} className="block h-1.5 w-full overflow-hidden rounded-full accent-action [&::-webkit-progress-bar]:bg-surface-2 [&::-webkit-progress-value]:bg-action" />
    </header>
  );
}

/** Treatment names that are still the untouched suggestions follow the studio language. */
function relabel(draft: SalonDraft, language: SalonDraft["language"]): SalonDraft {
  const before = suggestedTreatments(draft.industry, draft.language);
  const after = suggestedTreatments(draft.industry, language);
  return { ...draft, language, treatments: draft.treatments.map(item => ({ ...item, name: after[before.findIndex(s => s.name === item.name)]?.name ?? item.name })) };
}

export function SalonWizard() {
  const { state } = useStudio();
  const { draft, setDraft, step, setStep } = useSetupProgress();
  const savedSalon = useWorkspaceSlug("own");
  const [saving, setSaving] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const live = !!state.industry;
  const language = getActiveLocale();
  useEffect(() => {
    title.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [step, live]);
  useEffect(() => {
    if (draft.language !== language) setDraft(relabel(draft, language));
  }, [draft, language, setDraft]);

  const update = (patch: Partial<SalonDraft>) => setDraft({ ...draft, ...patch });
  const valid = step !== 1 || treatmentsValid(draft.treatments);
  const create = async () => {
    setSaving(true);
    try {
      const ready = { ...draft, language };
      if (await switchSalon("own", { ...ready, slug: suggestedSlug(ready, state.salon.slug) })) {
        setStep(0);
        setDraft(salonDraft(language));
      } else showToast(t("setup.switchFailed"));
    } finally { setSaving(false); }
  };
  const next = () => {
    if (saving || !valid) return;
    if (step === STEPS.length - 1) void create();
    else setStep(step + 1);
  };

  if (live) {
    const path = bookingHome(state.salon.slug);
    return <div className="space-y-5">
      <SetupProgress number={TOTAL} />
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-action-bg text-text"><Check aria-hidden /></span>
      <div className="space-y-2">
        <h1 ref={title} tabIndex={-1} className="text-h1 font-semibold tracking-tight">{t("setup.ready")}</h1>
        <p className="text-body text-text-secondary">{t("setup.readyHint")}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Link href={path} onClick={() => recordPageSeen(state.salon.slug)} className={buttonClass("primary", "lg", "w-full")}>
          <Globe size={18} aria-hidden />{t("setup.seePage")}
        </Link>
        <ButtonLink href="/studio" variant="secondary" size="lg" icon={<Sun size={18} aria-hidden />} className="w-full">{t("setup.goToDay")}</ButtonLink>
      </div>
      <p className="text-meta text-text-secondary">{t("trial.notice")}</p>
      <ReturnToDemo />
    </div>;
  }
  if (savedSalon) return <SalonEntry />;
  const question = STEPS[step];
  return <form onSubmit={e => { e.preventDefault(); next(); }} className="space-y-6">
    <SetupProgress number={step + 1} />
    <div className="space-y-2">
      <h1 tabIndex={-1} ref={title} className="text-h1 font-semibold tracking-tight">{t(`setup.${question}`)}</h1>
      <p className="text-body text-text-secondary">{t(`setup.${question}Hint`)}</p>
    </div>
    {step === 0 && <div className="space-y-5">
      <Field label={t("settings.name")}><TextInput autoComplete="organization" maxLength={80} value={draft.name} placeholder={t("setup.defaultName")} onChange={e => update({ name: e.target.value })} /></Field>
      <div className="space-y-2">
        <p className="text-body font-medium">{t("setup.type")}</p>
        <ChoiceCards<SetupType> label={t("setup.type")} value={draft.industry as SetupType}
          options={SETUP_TYPES.map(id => ({ value: id, label: t(`setup.${id}`) }))}
          onChange={industry => update({ industry, treatments: suggestedTreatments(industry, language) })} />
      </div>
    </div>}
    {step === 1 && <SetupTreatments list={draft.treatments} currency={draft.currency} language={language} change={treatments => update({ treatments })} />}
    <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
      {step > 0 && <IconButton label={t("welcome.back")} onClick={() => setStep(step - 1)}><ArrowLeft size={18} /></IconButton>}
      <Button type="submit" size="lg" className="flex-1" loading={saving} disabled={!valid}>
        {t(step === STEPS.length - 1 ? "setup.create" : "welcome.next")}<ArrowRight size={16} aria-hidden />
      </Button>
    </div>
    <p className="text-meta text-text-secondary">{t("setup.local")}</p>
    <ButtonLink href="/studio" variant="ghost">{t("setup.demo")}</ButtonLink>
  </form>;
}
