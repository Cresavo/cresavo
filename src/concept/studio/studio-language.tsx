"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { LanguageSwitch, useLocale } from "@/app/components/locale-provider";
import { t, translate } from "../i18n";
import { DEFAULT_CURRENCY } from "../i18n/business";
import { ConceptLanguage } from "../i18n/boundary";
import { SetupProgressProvider } from "./onboarding/progress";
import { useDemo } from "../store";

export function StudioLanguageSwitch() {
  const language = useLocale();
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
  const pathname = usePathname() ?? "";
  const isWebCall = pathname === "/studio/ring" || pathname.startsWith("/studio/ring/");
  return (
    <>
      {!isWebCall && (
        <aside className="demo-banner" aria-label={translate(language, "language.demoTitle")}>
          <span>{translate(language, "language.demoNotice")}</span>
          <StudioLanguageSwitch />
        </aside>
      )}
      <SetupProgressProvider>
        <ConceptLanguage key={state?.industry ? "own" : "demo"} language={language} currency={state?.localization.currency ?? DEFAULT_CURRENCY}>
          {children}
        </ConceptLanguage>
      </SetupProgressProvider>
    </>
  );
}

export function StudioLanguageSetting() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="font-medium">{t("language.label")}</p>
        <p className="text-sm text-text-secondary">{t("language.studioHint")}</p>
      </div>
      <StudioLanguageSwitch />
    </div>
  );
}
