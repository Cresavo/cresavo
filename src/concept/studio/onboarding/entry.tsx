"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "../../i18n";
import { hasOwnSalon, switchSalon } from "../../store";
import { showToast } from "../../ui/toast";
import { Button, ButtonLink } from "../../ui/button";
import { Card } from "../../ui/card";
import { useStudio } from "../use-studio";
import { DemoTour, firstVisit } from "./tour";

export function ReturnToDemo() {
  const router = useRouter();
  return <Button variant="ghost" onClick={async () => {
    if (await switchSalon("demo")) router.push("/studio");
    else showToast(t("setup.switchFailed"));
  }}>{t("setup.demo")}</Button>;
}

export function SalonEntry({ today = false }: { today?: boolean }) {
  const { state } = useStudio();
  const router = useRouter();
  const [tour, setTour] = useState(() => today && !state.industry && firstVisit());
  const explore = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => { setTour(false); explore.current?.focus(); }, []);
  if (state.industry) return <ReturnToDemo />;
  return <div className="mb-5">
    <Card className="space-y-3 p-4">
      <p className="font-medium">{t("setup.intro")}</p>
      <div className="flex flex-wrap gap-2">
        <div data-setup-entry className="rounded-md">{hasOwnSalon()
          ? <Button onClick={async () => { if (await switchSalon("own")) router.push("/studio"); else showToast(t("setup.switchFailed")); }}>{t("setup.resume")}</Button>
          : <ButtonLink href="/studio/setup">{t("setup.entry")}</ButtonLink>}</div>
        {today ? <Button ref={explore} variant="ghost" onClick={() => setTour(true)}>{t("setup.explore")}</Button>
          : <ButtonLink href="/studio" variant="ghost">{t("setup.explore")}</ButtonLink>}
      </div>
    </Card>
    {tour && <DemoTour close={close} />}
  </div>;
}
