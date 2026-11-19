"use client";

import { ArrowLeft, ArrowRight, Check, Link2, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { bookingHome, rebookLink } from "../../booking/links";
import { formatDuration, formatMoney } from "../../i18n/format";
import { t, translate } from "../../i18n";
import { INDUSTRIES, checkNewSlug, salonDraft, suggestedSlug, suggestedTreatments, type Industry, type SalonDraft } from "../../onboarding/salon";
import { useSetupProgress } from "./progress";
import { switchSalon, useWorkspaceSlug } from "../../store";
import { showToast } from "../../ui/toast";
import { Button, ButtonLink, IconButton } from "../../ui/button";
import { Card } from "../../ui/card";
import { Field, Segmented, Select, TextInput } from "../../ui/controls";
import { useStudio } from "../use-studio";
import { CopyBookingLink } from "./booking-link";
import { ReturnToDemo, SalonEntry } from "./entry";
import { SetupHours } from "./hours";
import { SetupTreatments } from "./treatments";

const steps = ["identity", "locale", "hours", "treatments", "staff", "address"] as const;

function SetupProgress({ number }: { number: number }) {
  return (
    <header className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-sm font-medium"><span>{t("setup.title")}</span><span className="text-text-secondary">{t("setup.step", { step: number, total: steps.length + 1 })}</span></div>
      <progress aria-label={t("setup.title")} value={number} max={steps.length + 1} className="block h-1.5 w-full overflow-hidden rounded-full accent-action [&::-webkit-progress-bar]:bg-surface-2 [&::-webkit-progress-value]:bg-action" />
    </header>
  );
}

export function SalonWizard() {
  const { state } = useStudio();
  const { draft, setDraft, step, setStep } = useSetupProgress();
  const savedSalon = useWorkspaceSlug("own");
  const [saving, setSaving] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const live = !!state.industry;
  useEffect(() => {
    title.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [step, live]);

  const update = (patch: Partial<SalonDraft>) => setDraft({ ...draft, ...patch });
  const slug = draft.slug;
  const check = checkNewSlug(slug, state.salon.slug);
  const name = draft.name.trim() || translate(draft.language, "setup.defaultName");
  const names = draft.treatments.map(item => item.name.trim().toLowerCase());
  const duplicate = new Set(names).size < names.length;
  const valid = (step !== 2 || Object.values(draft.hours).every(h => !h || h.open < h.close)) &&
    (step !== 3 || (!duplicate && names.every(Boolean))) && (step !== 5 || check.ok);
  const next = async (skip = false) => {
    if (saving) return;
    let nextDraft = draft;
    if (skip) {
      const defaults = salonDraft();
      const patches: Partial<SalonDraft>[] = [
        { name: "", industry: defaults.industry, slug: "", treatments: suggestedTreatments(defaults.industry, draft.language) }, { language: defaults.language, currency: defaults.currency }, { hours: {} },
        { treatments: [] }, { people: [""] }, { slug: suggestedSlug(draft, state.salon.slug) },
      ];
      nextDraft = { ...draft, ...patches[step] };
      if (step === 1 && draft.language !== defaults.language) nextDraft.treatments = suggestedTreatments(draft.industry, defaults.language);
      setDraft(nextDraft);
    }
    if (step === steps.length - 1) {
      setSaving(true);
      try {
        if (await switchSalon("own", nextDraft)) {
          setStep(0);
          setDraft(salonDraft());
        } else showToast(t("setup.switchFailed"));
      } finally { setSaving(false); }
    } else {
      if (step === 4 && !nextDraft.slug) setDraft({ ...nextDraft, slug: suggestedSlug(nextDraft, state.salon.slug) });
      setStep(step + 1);
    }
  };
  if (live) {
    const path = bookingHome(state.salon.slug);
    return <div className="space-y-5">
      <SetupProgress number={steps.length + 1} />
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-action-bg text-text"><Check aria-hidden /></span>
      <h1 ref={title} tabIndex={-1} className="text-3xl font-semibold tracking-tight">{t("setup.live")}</h1>
      <p className="text-text-secondary">{t("setup.local")}</p>
      <Card className="space-y-3 p-5">
        <p className="font-medium">{state.salon.name}</p>
        <ButtonLink href={path} icon={<Link2 size={18} />} size="lg" className="w-full whitespace-normal break-all">{path}</ButtonLink>
        <CopyBookingLink slug={state.salon.slug} />
      </Card>
      <div className="flex flex-wrap gap-2">
        <ButtonLink variant="secondary" href={state.services[0] ? rebookLink(state.salon.slug, state.services[0].id) : path + "#book"}>{t("setup.try")}</ButtonLink>
        <ButtonLink href="/studio" variant="ghost">{t("setup.today")}</ButtonLink>
      </div>
      <ReturnToDemo />
    </div>;
  }
  if (savedSalon) return <SalonEntry />;
  const question = steps[step];
  return <form onSubmit={e => { e.preventDefault(); if (valid) void next(); }} className="space-y-6">
    <SetupProgress number={step + 1} />
    <div className="space-y-2">
      <h1 tabIndex={-1} ref={title} className="text-[28px] font-semibold leading-tight tracking-tight sm:text-4xl">{t(`setup.${question}`)}</h1>
      <p className="text-text-secondary">{t(`setup.${question}Hint`)}</p>
    </div>
    {step === 0 && <div className="space-y-4">
      <Field label={t("settings.name")}><TextInput autoComplete="organization" maxLength={80} value={draft.name} placeholder={t("setup.defaultName")} onChange={e => update({ name: e.target.value })} /></Field>
      <Field label={t("setup.type")}><Select value={draft.industry} onChange={e => {
        const industry = e.target.value as Industry;
        update({ industry, treatments: suggestedTreatments(industry, draft.language) });
      }}>{INDUSTRIES.map(id => <option key={id} value={id}>{t(`setup.${id}`)}</option>)}</Select></Field>
    </div>}
    {step === 1 && <div className="space-y-4">
      <Field label={t("language.businessDefault")}><Select value={draft.language} onChange={e => {
        const language = e.target.value === "sv" ? "sv" : "en";
        const before = suggestedTreatments(draft.industry, draft.language);
        const after = suggestedTreatments(draft.industry, language);
        update({ language, treatments: draft.treatments.map(item => ({ ...item, name: after[before.findIndex(s => s.name === item.name)]?.name ?? item.name })) });
      }}><option value="sv">{t("language.sv")}</option><option value="en">{t("language.en")}</option></Select></Field>
      <Field label={t("setup.currency")}><Select value={draft.currency} onChange={e => update({ currency: e.target.value })}>{(["SEK", "EUR", "GBP", "USD"] as const).map(c => <option value={c} key={c}>{t(`setup.currency.${c}`)}</option>)}</Select></Field>
    </div>}
    {step === 2 && <SetupHours hours={draft.hours} change={hours => update({ hours })} />}
    {step === 3 && <><SetupTreatments list={draft.treatments} currency={draft.currency} change={treatments => update({ treatments })} />
      {duplicate && <p role="alert">{t("services.issue.nameTaken")}</p>}</>}
    {step === 4 && <div className="space-y-3">
      <Segmented label={t("setup.staff")} value={draft.people.length > 1 ? "team" : "solo"} options={[{ value: "solo", label: t("setup.solo") }, { value: "team", label: t("setup.team") }]}
        onChange={v => update({ people: v === "team" ? [draft.people[0], ""] : [draft.people[0]] })} />
      {draft.people.map((person, i) => {
        const label = i ? t("setup.person", { number: i }) : t("setup.ownerName");
        return <div key={i} className="flex items-end gap-2"><div className="min-w-0 flex-1"><Field label={label}><TextInput value={person} maxLength={80}
          onChange={e => update({ people: draft.people.map((v, n) => n === i ? e.target.value : v) })} /></Field></div>
          {i > 0 && <IconButton label={t("setup.remove", { name: person || label })} onClick={() => update({ people: draft.people.filter((_, n) => n !== i) })}><X size={18} /></IconButton>}
        </div>;
      })}
      {draft.people.length > 1 && <Button variant="secondary" icon={<Plus size={16} />} onClick={() => update({ people: [...draft.people, ""] })}>{t("setup.addPerson")}</Button>}
    </div>}
    {step === 5 && <div className="space-y-4">
      <Field label={t("address.slug.label")}><TextInput value={slug} autoCapitalize="none" spellCheck={false} aria-invalid={!check.ok}
        onChange={e => update({ slug: e.target.value.toLowerCase() })} /></Field>
      {!check.ok && <p role="alert">{t(`address.slug.${check.problem}`)}</p>}
      <Card className="space-y-1 p-4" aria-live="polite"><p className="text-sm text-text-secondary">{t("setup.preview")}</p>
        <p className="text-lg font-semibold">{name}</p><p className="break-all text-sm">{window.location.origin}{bookingHome(slug)}</p>
        {draft.treatments.slice(0, 1).map(item => <div key={item.name} className="mt-3 flex items-center justify-between gap-3 border-t border-hairline pt-3 text-sm">
          <span>{item.name} · {formatDuration(item.duration)}</span><strong>{formatMoney(item.price, draft.currency, draft.language)}</strong>
        </div>)}
      </Card>
    </div>}
    <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
      {step > 0 && <IconButton label={t("welcome.back")} onClick={() => setStep(step - 1)}><ArrowLeft size={18} /></IconButton>}
      <Button type="submit" className="flex-1" disabled={!valid || saving}>{t(step === 5 ? "setup.publish" : "welcome.next")}<ArrowRight size={16} /></Button>
      <Button variant="ghost" disabled={saving} onClick={() => next(true)}>{t("setup.skip")}</Button>
    </div>
    <p className="text-sm text-text-secondary">{t("setup.local")}</p>
    <ButtonLink href="/studio" variant="ghost">{t("setup.demo")}</ButtonLink>
  </form>;
}
