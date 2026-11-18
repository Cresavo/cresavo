"use client";

import type { ReactNode } from "react";
import { ToggleRight } from "lucide-react";
import type { ModuleKey } from "../../data/types";
import { t } from "../../i18n";
import { ButtonLink } from "../../ui/button";
import { EmptyState } from "../../ui/empty-state";
import { BackLink } from "../back-link";
import { PageHeader } from "../page-header";
import { useStudio } from "../use-studio";

interface MorePageProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** When set, the page is replaced by a hint if the module is switched off. */
  module?: ModuleKey;
  children: ReactNode;
}

/** Frame for pages under More: back link on phones, header, module check. */
export function MorePage({ title, subtitle, actions, module, children }: MorePageProps) {
  const { state } = useStudio();
  const off = module && !state.modules[module];
  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={off ? undefined : actions}
        back={<BackLink href="/studio/more" label={t("nav.more")} className="lg:hidden" />}
      />
      {off ? (
        <EmptyState
          icon={<ToggleRight size={22} />}
          title={t("more.moduleOff")}
          text={t("more.moduleOffText")}
          action={<ButtonLink href="/studio/more/features" size="sm">{t("nav.features")}</ButtonLink>}
        />
      ) : (
        children
      )}
    </>
  );
}
