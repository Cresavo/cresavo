"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "../../i18n";
import { switchSalon, useWorkspaceSlug } from "../../store";
import { showToast } from "../../ui/toast";
import { Button, ButtonLink } from "../../ui/button";
import { Card } from "../../ui/card";
import { PageHeader } from "../page-header";
import { useStudio } from "../use-studio";
import { DemoTour, firstVisit } from "./tour";
import { TrialNotice } from "./trial-notice";

export function SalonEntry({ today = false, standalone = false }: { today?: boolean; standalone?: boolean }) {
  const { state } = useStudio();
  const router = useRouter();
  const savedSalon = useWorkspaceSlug("own");
  const [tour, setTour] = useState(() => today && !state.industry && firstVisit());
  const explore = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => { setTour(false); explore.current?.focus(); }, []);
  if (state.industry) return <TrialNotice />;
  return <div className="mb-5">
    <Card className="space-y-3 p-4">
      {standalone
        ? <PageHeader tools={false} title={t("setup.title")} subtitle={t(savedSalon ? "setup.saved" : "setup.intro")} />
        : <p className="font-medium">{t(savedSalon ? "setup.saved" : "setup.intro")}</p>}
      <div className="flex flex-wrap gap-2">
        <div data-setup-entry className="rounded-md">{savedSalon
          ? <Button variant={today ? "secondary" : "primary"} onClick={async () => { if (await switchSalon("own")) router.push("/studio"); else showToast(t("setup.switchFailed")); }}>{t("setup.resume")}</Button>
          : <ButtonLink variant={today ? "secondary" : "primary"} href="/studio/setup">{t("setup.entry")}</ButtonLink>}</div>
        {today ? <Button ref={explore} variant="ghost" onClick={() => setTour(true)}>{t("setup.explore")}</Button>
          : <ButtonLink href="/studio" variant="ghost">{t("setup.explore")}</ButtonLink>}
      </div>
    </Card>
    {tour && <DemoTour close={close} />}
  </div>;
}
