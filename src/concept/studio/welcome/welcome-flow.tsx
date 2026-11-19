"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { formatNumber } from "../../i18n/format";
import { t, term } from "../../i18n";
import { monthlyTotal, MODULES } from "../../modules/registry";
import { HELP_WISHES, setupFromAnswers, type Answers, type HelpWish, type TeamSize } from "../../onboarding/setup";
import { getPack, PACKS } from "../../packs";
import { startBusiness } from "../../store";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { Chip } from "../../ui/controls";
import { cx } from "../../ui/cx";
import { showToast } from "../../ui/toast";
import type { PackId } from "../../data/types";
import type { MessageKey } from "../../i18n";

const TEAM_OPTIONS: { id: TeamSize; label: MessageKey }[] = [
  { id: "solo", label: "welcome.team.solo" },
  { id: "small", label: "welcome.team.small" },
  { id: "large", label: "welcome.team.large" },
];

const STEPS = 3;

function Option({ selected, title, text, onSelect }: { selected: boolean; title: string; text?: string; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={cx(
        "flex w-full items-center gap-3 rounded-lg bg-surface p-4 text-left ring-1 ring-inset transition-colors",
        selected ? "bg-action-bg ring-2 ring-action" : "ring-hairline hover:bg-surface-2",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        {text && <span className="mt-0.5 block text-sm text-text-secondary">{text}</span>}
      </span>
      {selected && <Check size={20} className="shrink-0 text-action" />}
    </button>
  );
}

/** "What kind of business do you have?", two more questions, then a summary of the studio that was set up. */
export function WelcomeFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pack, setPack] = useState<PackId | null>(null);
  const [team, setTeam] = useState<TeamSize | null>(null);
  const [help, setHelp] = useState<HelpWish[]>([]);

  const answers: Answers | null = pack && team ? { pack, team, help } : null;
  const canContinue = [pack !== null, team !== null, true][step];
  const toggle = (wish: HelpWish) => setHelp((current) => (current.includes(wish) ? current.filter((w) => w !== wish) : [...current, wish]));

  const open = async () => {
    if (!answers) return;
    await startBusiness(setupFromAnswers(answers));
    showToast(t("welcome.ready.toast"));
    router.push("/studio");
  };

  if (step === STEPS && answers) {
    const setup = setupFromAnswers(answers);
    const chosen = getPack(answers.pack);
    const on = MODULES.filter((module) => setup.modules?.includes(module.id));
    const rows: [string, string][] = [
      [t("welcome.ready.words"), t("welcome.ready.wordsValue", { customers: term("customer", { plural: true, vocabulary: chosen.vocabulary }), services: term("service", { plural: true, vocabulary: chosen.vocabulary }) })],
      [t("welcome.ready.services"), chosen.services.slice(0, 4).map((service) => service.name).join(", ")],
      [t("welcome.ready.modules"), on.map((module) => t(module.name)).join(", ")],
    ];
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight sm:text-3xl">{t("welcome.ready.title")}</h1>
          <p className="text-[15px] text-text-secondary">
            {t("welcome.ready.text", { pack: t(`pack.${chosen.id}.name`), team: t(setup.solo ? "welcome.ready.team.solo" : "welcome.ready.team.team") })}
          </p>
        </div>
        <Card className="divide-y divide-hairline">
          {rows.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5 px-4 py-3 text-sm sm:flex-row sm:justify-between sm:gap-4">
              <span className="text-text-secondary">{label}</span>
              <span className="font-medium sm:text-right">{value}</span>
            </div>
          ))}
          <div className="flex justify-between px-4 py-3 text-sm">
            <span className="text-text-secondary">{t("features.total")}</span>
            <span className="font-medium tabular-nums">{t("features.price", { price: formatNumber(monthlyTotal(setup.modules ?? [])) })}</span>
          </div>
        </Card>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setStep(STEPS - 1)}>{t("welcome.back")}</Button>
          <Button size="lg" className="flex-1" onClick={open}>{t("welcome.ready.open")}</Button>
        </div>
      </div>
    );
  }

  const titles: MessageKey[] = ["welcome.pack.title", "welcome.team.title", "welcome.help.title"];
  const texts: MessageKey[] = ["welcome.pack.text", "welcome.team.text", "welcome.help.text"];
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-action">{t("welcome.step", { step: step + 1, total: STEPS })}</p>
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight sm:text-3xl">{t(titles[step])}</h1>
        <p className="text-[15px] text-text-secondary">{t(texts[step])}</p>
      </div>
      {step === 0 && (
        <div className="space-y-2.5">
          {PACKS.map((option) => (
            <Option key={option.id} selected={pack === option.id} title={t(`pack.${option.id}.name`)} text={t(`pack.${option.id}.description`)} onSelect={() => setPack(option.id)} />
          ))}
        </div>
      )}
      {step === 1 && (
        <div className="space-y-2.5">
          {TEAM_OPTIONS.map((option) => (
            <Option key={option.id} selected={team === option.id} title={t(option.label)} onSelect={() => setTeam(option.id)} />
          ))}
        </div>
      )}
      {step === 2 && (
        <div className="flex flex-wrap gap-2">
          {HELP_WISHES.map((wish) => (
            <Chip key={wish} active={help.includes(wish)} onClick={() => toggle(wish)}>{t(`welcome.help.${wish}`)}</Chip>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        {step > 0 && <Button variant="ghost" onClick={() => setStep(step - 1)}>{t("welcome.back")}</Button>}
        <Button size="lg" className="flex-1" disabled={!canContinue} onClick={() => setStep(step + 1)}>{t("welcome.next")}</Button>
      </div>
    </div>
  );
}
