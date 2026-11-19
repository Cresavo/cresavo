"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { t } from "../../i18n";
import { deleteTrialSalon, dismissTrialRemoved, switchSalon } from "../../store";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { ConfirmDialog } from "../../ui/confirm-dialog";
import { showToast } from "../../ui/toast";

export function ReturnToDemo() {
  const router = useRouter();
  return <Button variant="ghost" onClick={async () => {
    if (await switchSalon("demo")) router.push("/studio");
    else showToast(t("setup.switchFailed"));
  }}>{t("setup.demo")}</Button>;
}

/** A calm reminder in the owner's own salon that it is a browser-only trial, with a way to delete it now. */
export function TrialNotice() {
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();
  return (
    <Card className="mt-6 space-y-3 p-4">
      <p className="text-body text-text-secondary">{t("trial.notice")}</p>
      <div className="flex flex-wrap gap-2">
        <ReturnToDemo />
        <Button variant="tertiary" icon={<Trash2 size={16} />} onClick={() => setConfirming(true)}>{t("trial.delete")}</Button>
      </div>
      <ConfirmDialog open={confirming} onClose={() => setConfirming(false)} destructive
        title={t("trial.confirmTitle")} description={t("trial.confirmText")} verb={t("trial.confirmVerb")}
        onConfirm={() => {
          setConfirming(false);
          deleteTrialSalon();
          router.push("/studio");
          showToast(t("trial.deleted"));
        }} />
    </Card>
  );
}

/** Shown once after an idle trial salon was removed on opening the studio. */
export function TrialRemoved() {
  const router = useRouter();
  const go = (path: string) => {
    dismissTrialRemoved();
    router.push(path);
  };
  return (
    <div className="mx-auto w-full max-w-lg space-y-4 py-4 lg:py-10">
      <h1 className="text-h1 font-semibold tracking-tight">{t("trial.removedTitle")}</h1>
      <p className="text-body text-text-secondary">{t("trial.removedText")}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button size="lg" onClick={() => go("/studio/setup")}>{t("trial.startNew")}</Button>
        <Button size="lg" variant="secondary" onClick={() => go("/studio")}>{t("setup.demo")}</Button>
      </div>
    </div>
  );
}
