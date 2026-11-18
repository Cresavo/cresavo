"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Globe, Loader2 } from "lucide-react";
import { t } from "../../i18n";
import { checkDomain, DOMAIN_STEPS, dnsInstruction, type DomainConnection, type DomainStatus } from "../../page/domain";
import { dispatch } from "../../store";
import { Badge } from "../../ui/badge";
import { Button, ButtonLink } from "../../ui/button";
import { Card } from "../../ui/card";
import { Field, TextInput } from "../../ui/controls";
import { showToast } from "../../ui/toast";
import { useStudio } from "../use-studio";
import { CopyField } from "./copy-field";
import { addLiveDomain, checkLiveDomain, liveDomainsEnabled, removeLiveDomain } from "./domain-api";

/** Level 3: the business's own domain. Shows the one DNS record to add and where the connection stands. */
export function DomainSection() {
  const { state } = useStudio();
  const [live, setLive] = useState<boolean | null>();
  useEffect(() => {
    void liveDomainsEnabled().then(setLive);
  }, []);
  if (!state.modules.domain) return <Off />;
  if (live === undefined) return <p role="status">{t("domain.loading")}</p>;
  if (live === null) return <p role="status">{t("domain.statusUnavailable")}</p>;
  return state.domain ? <Connected connection={state.domain} live={live} /> : <Start live={live} />;
}

function Off() {
  return (
    <Card className="space-y-3 p-4">
      <p className="text-sm text-text-secondary">{t("domain.off")}</p>
      <ButtonLink href="/studio/more/features" variant="secondary" icon={<Globe size={18} />}>{t("domain.switchOn")}</ButtonLink>
    </Card>
  );
}

function Start({ live }: { live: boolean }) {
  const [host, setHost] = useState("");
  const [busy, setBusy] = useState(false);
  const check = checkDomain(host);
  const problem = host.trim() && !check.ok ? t(`domain.problem.${check.problem}`) : undefined;
  const connect = async () => {
    if (!check.ok || busy) return;
    setBusy(true);
    const status = live ? await addLiveDomain(check.host) : undefined;
    if (live && !status) showToast(t("domain.operationFailed"));
    else dispatch({ type: "domain/connect", host: check.host, status });
    setBusy(false);
  };
  return (
    <Card className="space-y-3 p-4">
      <p className="text-sm text-text-secondary">{t("domain.intro")}</p>
      <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void connect(); }}>
        <Field label={t("domain.label")} hint={problem ?? t("domain.hint")}>
          <TextInput value={host} onChange={(event) => setHost(event.target.value)} placeholder={t("domain.placeholder")} autoCapitalize="none" autoComplete="off" spellCheck={false} aria-invalid={!!problem} />
        </Field>
        <Button type="submit" disabled={!check.ok || busy} icon={busy ? <Loader2 size={18} className="animate-spin" /> : <Globe size={18} />}>{t("domain.connect")}</Button>
      </form>
    </Card>
  );
}

function Connected({ connection, live }: { connection: DomainConnection; live: boolean }) {
  const [busy, setBusy] = useState(false);
  const record = dnsInstruction(connection.host);
  const recheck = async () => {
    if (busy) return;
    setBusy(true);
    const status = live ? await checkLiveDomain(connection.host) : undefined;
    if (live && !status) showToast(t("domain.operationFailed"));
    else dispatch({ type: "domain/check", host: connection.host, status });
    setBusy(false);
  };
  const remove = async () => {
    if (busy) return;
    setBusy(true);
    const removed = !live || await removeLiveDomain(connection.host);
    if (!removed) showToast(t("domain.operationFailed"));
    else if (dispatch({ type: "domain/remove", host: connection.host })) showToast(t("domain.removed"));
    setBusy(false);
  };
  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 break-all font-semibold">{connection.host}</p>
        {!live && <Badge>{t("common.simulated")}</Badge>}
      </div>
      {connection.status !== "secure" && (
        <div className="space-y-2">
          <p className="text-sm">{t("domain.record.help", { provider: t("domain.record.provider") })}</p>
          <CopyField label={t("domain.record.type")} value={record.type} />
          <CopyField label={t("domain.record.name")} value={record.name} />
          <CopyField label={t("domain.record.value")} value={record.value} />
          <p className="text-xs text-text-secondary">{t("domain.record.wait")}</p>
        </div>
      )}
      <Steps status={connection.status} />
      {connection.status === "secure" && <p className="text-sm text-text-secondary">{t("domain.live", { host: connection.host })}</p>}
      <div className="flex flex-wrap gap-2">
        {connection.status !== "secure" && <Button variant="secondary" disabled={busy} icon={busy ? <Loader2 size={18} className="animate-spin" /> : undefined} onClick={recheck}>{t("domain.check")}</Button>}
        <Button variant="ghost" disabled={busy} onClick={remove}>{t("domain.remove")}</Button>
      </div>
    </Card>
  );
}

function Steps({ status }: { status: DomainStatus }) {
  const current = DOMAIN_STEPS.indexOf(status);
  return (
    <ol aria-label={t("domain.steps")} className="space-y-2">
      {DOMAIN_STEPS.map((step, index) => {
        const done = index < current || status === "secure";
        const Icon = done ? CheckCircle2 : Circle;
        return (
          <li key={step} aria-current={index === current ? "step" : undefined} className="flex items-start gap-2.5 text-sm">
            <Icon size={18} className={done ? "mt-0.5 shrink-0 text-action" : index === current ? "mt-0.5 shrink-0 text-warning" : "mt-0.5 shrink-0 text-text-secondary"} />
            <span>
              <span className={index === current ? "font-semibold" : ""}>{t(`domain.status.${step}`)}</span>
              {index === current && status !== "secure" && <span className="block text-text-secondary">{t(`domain.status.${step}.text`)}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
