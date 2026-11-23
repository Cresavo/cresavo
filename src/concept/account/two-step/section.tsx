"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/locale";
import { translate, type MessageKey } from "../../i18n";
import { Button } from "../../ui/button";
import { Notice } from "../../ui/notice";
import { StepHeading } from "../step-heading";
import { ConfirmForm } from "./confirm-form";
import { RecoveryCodes } from "./recovery-codes";
import { TwoStepSetup } from "./setup";

type View = "status" | "setup" | "disable" | "regenerate" | { codes: string[]; done?: MessageKey };

/**
 * "Two-step sign-in" on the account page: its state, setup, turning it off and new recovery codes. Turning it on
 * or off signs the other devices out; this one stays signed in with the cookie the answer set.
 */
export function TwoStepSection({ language, email, enabled }: { language: Locale; email: string; enabled: boolean }) {
  const t = (key: MessageKey) => translate(language, key);
  const router = useRouter();
  const [view, setView] = useState<View>("status");
  const [done, setDone] = useState<MessageKey | null>(null);
  // What this page changed, until the refreshed server props say the same.
  const [changed, setChanged] = useState<boolean | null>(null);
  const on = changed ?? enabled;
  // Back on the overview after a step: focus its heading, never on first load.
  const [returned, setReturned] = useState(false);

  function finish(message: MessageKey | null, nowOn: boolean) {
    setView("status");
    setReturned(true);
    setDone(message);
    setChanged(nowOn);
    router.refresh();
  }

  const back = () => { setView("status"); setReturned(true); };
  if (view === "setup") return <TwoStepSetup language={language} onCancel={back} onEnabled={(codes) => setView({ codes, done: "account.mfa.done.on" })} />;
  if (typeof view === "object") return <RecoveryCodes codes={view.codes} email={email} language={language} onSaved={() => finish(view.done ?? null, true)} />;
  if (view === "disable") {
    return (
      <ConfirmForm language={language} title="account.mfa.disable" text="account.mfa.disable.text" submit="account.mfa.disable"
        path="/api/owner/mfa/disable" allowRecovery danger onCancel={back} onDone={() => finish("account.mfa.done.off", false)} />
    );
  }
  if (view === "regenerate") {
    return (
      <ConfirmForm language={language} title="account.mfa.regenerate" text="account.mfa.regenerate.text" submit="account.mfa.regenerate"
        path="/api/owner/mfa/recovery-codes" onCancel={back}
        onDone={(answer) => setView({ codes: Array.isArray(answer.body.recoveryCodes) ? answer.body.recoveryCodes.map(String) : [] })} />
    );
  }

  return (
    <section className="space-y-3" aria-labelledby="two-step-title">
      <StepHeading id="two-step-title" focus={returned}>{t("account.mfa.title")}</StepHeading>
      {done && <Notice tone="success" role="status">{t(done)}</Notice>}
      <p className="text-body text-text-secondary">{t(on ? "account.mfa.on" : "account.mfa.off")}</p>
      {on && <p className="text-meta text-text-secondary">{t("account.mfa.resetNote")}</p>}
      <div className="flex flex-wrap gap-2">
        {on ? (
          <>
            <Button variant="secondary" onClick={() => { setDone(null); setView("regenerate"); }}>{t("account.mfa.regenerate")}</Button>
            <Button variant="danger" onClick={() => { setDone(null); setView("disable"); }}>{t("account.mfa.disable")}</Button>
          </>
        ) : (
          <Button onClick={() => { setDone(null); setView("setup"); }}>{t("account.mfa.setup.start")}</Button>
        )}
      </div>
    </section>
  );
}
