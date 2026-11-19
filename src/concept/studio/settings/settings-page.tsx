"use client";

import type { ReactNode } from "react";
import { t } from "../../i18n";
import { MorePage } from "../more/more-page";
import { ADVANCED_PAGE } from "../nav";

/** A page inside Settings: its back link leads to the Settings overview. */
export function SettingsSubPage({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return <MorePage title={title} subtitle={subtitle} parent={{ href: "/studio/more/settings", label: t("nav.settings") }}>{children}</MorePage>;
}

/** A page inside Advanced: its back link leads to the Advanced overview. */
export function AdvancedSubPage({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return <MorePage title={title} subtitle={subtitle} parent={{ href: ADVANCED_PAGE, label: t("nav.advanced") }}>{children}</MorePage>;
}
