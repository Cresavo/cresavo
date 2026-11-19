"use client";

import type { Locale } from "@/lib/locale";
import type { ReactNode } from "react";
import { LanguageSwitch, useLocale } from "@/app/components/locale-provider";
import { t, translate } from "../i18n";
import { DEFAULT_CURRENCY } from "../i18n/business";
import { ConceptLanguage } from "../i18n/boundary";
import { useDemo } from "../store";

function StudioLanguageSwitch({ language }: { language: Locale }) {
  return <LanguageSwitch labels={{
    name: translate(language, "language.label"),
    error: translate(language, "language.updated"),
    en: translate(language, "language.en"),
    sv: translate(language, "language.sv"),
  }} />;
}

export function StudioLanguage({ children }: { children: ReactNode }) {
  const language = useLocale();
  const state = useDemo();
  return (
    <>
      <aside className="demo-banner" aria-label={translate(language, "language.demoTitle")}>
        <span>{translate(language, "language.demoNotice")}</span>
        <StudioLanguageSwitch language={language} />
      </aside>
      <ConceptLanguage language={language} currency={state?.localization.currency ?? DEFAULT_CURRENCY}>
        {children}
      </ConceptLanguage>
    </>
  );
}

export function StudioLanguageSetting() {
  const language = useLocale();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="font-medium">{t("language.label")}</p>
        <p className="text-sm text-text-secondary">{t("language.studioHint")}</p>
      </div>
      <StudioLanguageSwitch language={language} />
    </div>
  );
}
