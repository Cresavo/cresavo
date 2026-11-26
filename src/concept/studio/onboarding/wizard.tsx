"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getActiveLocale, t } from "../../i18n";
import { SETUP_TYPES, suggestedSlug, suggestedTreatments, treatmentsValid, type SalonDraft, type SetupType } from "../../onboarding/salon";
import { waitForLogo } from "./logo-queue";
import { useSetupProgress } from "./progress";
import { switchSalon, useWorkspaceSlug } from "../../store";
import { showToast } from "../../ui/toast";
import { Button, ButtonLink } from "../../ui/button";
import { ChoiceCards, Field, TextInput } from "../../ui/controls";
import { PageHeader } from "../page-header";
import { useStudio } from "../use-studio";
import { SalonEntry } from "./entry";
import { SetupFinish } from "./finish";
import { hoursIssue, SetupHours } from "./hours";
import { SetupLook } from "./look";
import { SetupTeam } from "./team";
import { SetupTreatments } from "./treatments";

/** Five questions, each answerable with what is already filled in; the sixth screen is the finished salon. */
const STEPS = ["identity", "hours", "treatments", "team", "look"] as const;
const TOTAL = STEPS.length + 1;

function SetupProgress({ number }: { number: number }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-meta font-medium"><span>{t("setup.title")}</span><span className="text-text-secondary">{t("setup.step", { step: number, total: TOTAL })}</span></div>
      <progress aria-label={t("setup.title")} value={number} max={TOTAL} className="block h-1 w-full overflow-hidden rounded-full accent-action [&::-moz-progress-bar]:bg-action [&::-webkit-progress-bar]:bg-surface-2 [&::-webkit-progress-value]:bg-action" />
    </div>
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
  const { draft, setDraft, step: saved, setStep, latestDraft, clear, restored } = useSetupProgress();
  const step = Math.min(saved, STEPS.length - 1);
  const savedSalon = useWorkspaceSlug("own");
  const [saving, setSaving] = useState(false);
  const [back, setBack] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const live = !!state.industry;
  const language = getActiveLocale();
  useEffect(() => {
    title.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [step, live, restored]);
  useEffect(() => {
    if (draft.language !== language) setDraft(relabel(draft, language));
  }, [draft, language, setDraft]);

  if (live) return <SetupFinish titleRef={title} progress={<SetupProgress number={TOTAL} />} />;
  if (savedSalon) return <div className="md:max-w-form lg:mx-auto"><SalonEntry standalone /></div>;
  if (!restored) return null;

  const update = (patch: Partial<SalonDraft>) => setDraft({ ...draft, ...patch });
  const question = STEPS[step];
  const valid = question === "hours" ? !hoursIssue(draft.hours) : question === "treatments" ? treatmentsValid(draft.treatments) : true;
  const name = draft.name.trim() || t("setup.defaultName");
  const go = (next: number) => { setBack(next < step); setStep(next); };
  const create = async () => {
    setSaving(true);
    try {
      await waitForLogo();
      const ready = { ...latestDraft(), language };
      if (await switchSalon("own", { ...ready, slug: suggestedSlug(ready, state.salon.slug) })) clear(language);
      else showToast(t("setup.switchFailed"));
    } finally { setSaving(false); }
  };
  const next = () => {
    if (saving || !valid) return;
    if (step === STEPS.length - 1) void create();
    else go(step + 1);
  };

  return <form onSubmit={e => { e.preventDefault(); next(); }} className="space-y-6 md:max-w-form lg:mx-auto">
    <SetupProgress number={step + 1} />
    <div key={question} className="setup-step" data-back={back || undefined}>
      <PageHeader tools={false} titleRef={title} title={t(`setup.${question}`)} subtitle={t(`setup.${question}Hint`)} />
      {question === "identity" && <div className="space-y-6">
        <Field width="short" label={t("settings.name")}><TextInput autoComplete="organization" maxLength={80} value={draft.name} placeholder={t("setup.defaultName")} onChange={e => update({ name: e.target.value })} /></Field>
        <div className="space-y-2">
          <p className="text-body font-medium">{t("setup.type")}</p>
          <ChoiceCards<SetupType> label={t("setup.type")} value={draft.industry as SetupType}
            options={SETUP_TYPES.map(id => ({ value: id, label: t(`setup.${id}`) }))}
            onChange={industry => update({ industry, treatments: suggestedTreatments(industry, language) })} />
        </div>
      </div>}
      {question === "hours" && <SetupHours hours={draft.hours} change={hours => update({ hours })} />}
      {question === "treatments" && <SetupTreatments list={draft.treatments} currency={draft.currency} language={language} change={treatments => update({ treatments })} />}
      {question === "team" && <SetupTeam people={draft.people} change={people => update({ people })} />}
      {question === "look" && <SetupLook draft={draft} name={name} change={update} />}
    </div>
    <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
      {step > 0
        ? <Button variant="tertiary" icon={<ArrowLeft size={18} />} onClick={() => go(step - 1)}>{t("welcome.back")}</Button>
        : <ButtonLink href="/studio" variant="ghost" className="text-text-secondary max-sm:order-last max-sm:w-full max-sm:justify-start">{t("setup.demo")}</ButtonLink>}
      <Button type="submit" size="lg" className="ml-auto max-sm:flex-1" loading={saving} disabled={!valid}>
        {t(step === STEPS.length - 1 ? "setup.create" : "welcome.next")}<ArrowRight size={16} aria-hidden />
      </Button>
    </div>
  </form>;
}
