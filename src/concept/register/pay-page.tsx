"use client";

import { useState } from "react";
import { CircleCheck, Clock, Leaf, Unlink } from "lucide-react";
import type { Locale } from "@/lib/locale";
import "../booking/tenant-theme.css";
import { formatMinor } from "../booking/policy-summary";
import { t, type MessageKey } from "../i18n";
import { ConceptLanguage } from "../i18n/boundary";
import { DEFAULT_CURRENCY } from "../i18n/business";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { SuccessCheck } from "../ui/feedback";
import { ChoiceCards } from "../ui/controls";
import { cx } from "../ui/cx";
import { Notice } from "../ui/notice";

type Method = "card" | "swish";
type Step = "pending" | "paid" | "used" | "expired" | "invalid";

interface Shown {
  salon: string;
  amountMinor: number;
  currency: string;
  methods: Method[];
  reference: string;
}

const ENDS: Record<Exclude<Step, "pending">, { icon: typeof Clock; title: MessageKey; text: MessageKey; tone?: "success" }> = {
  paid: { icon: CircleCheck, title: "pay.paid.title", text: "pay.paid.text", tone: "success" },
  used: { icon: CircleCheck, title: "pay.used.title", text: "pay.used.text" },
  expired: { icon: Clock, title: "pay.expired.title", text: "pay.expired.text" },
  invalid: { icon: Unlink, title: "pay.invalid.title", text: "pay.expired.text" },
};

/** The page a customer's phone opens from the demo register's QR code. Only the heading, the DEMO- reference and the watermark mark it as a demo, like the receipt. */
export function PayPage({ token, language, initial, request }: { token: string; language: Locale; initial: Step; request: Shown | null }) {
  return (
    <ConceptLanguage language={language} currency={request?.currency ?? DEFAULT_CURRENCY}>
      <div className="flex min-h-dvh flex-col">
        {request && (
          <header className="booking-safe-top border-b border-hairline bg-surface">
            <div className="booking-gutters mx-auto flex min-h-14 w-full max-w-md items-center gap-3 font-semibold leading-tight tracking-tight">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-action text-on-action"><Leaf size={16} /></span>
              <span className="min-w-0 break-words">{request.salon}</span>
            </div>
          </header>
        )}
        <main className="booking-gutters mx-auto w-full max-w-md flex-1 pb-8 pt-5">
          <Payment token={token} initial={initial} request={request} />
        </main>
      </div>
    </ConceptLanguage>
  );
}

function Payment({ token, initial, request }: { token: string; initial: Step; request: Shown | null }) {
  const [step, setStep] = useState<Step>(initial);
  const [method, setMethod] = useState<Method>(request?.methods[0] ?? "card");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (step !== "pending" || !request) {
    const end = ENDS[step === "pending" ? "invalid" : step];
    return (
      <Card className="ui-arrive space-y-4 p-6 text-center">
        <span data-tone={end.tone} className={cx("mx-auto flex size-12 items-center justify-center rounded-full text-text", end.tone ? "bg-success-bg" : "bg-action-bg")}>
          {step === "paid" ? <span data-tone-mark className="flex"><SuccessCheck /></span> : <end.icon size={22} />}
        </span>
        <h1 className="text-h2 font-semibold tracking-tight">{t(end.title)}</h1>
        <p className="text-body text-text-secondary">{t(end.text)}</p>
        {step === "paid" && <p className="text-meta tabular-nums text-text-secondary">{`${formatMinor(request!.amountMinor, request!.currency)} · ${t(`register.${method}`)} · ${request!.reference}`}</p>}
      </Card>
    );
  }

  const amount = formatMinor(request.amountMinor, request.currency);
  const pay = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch(`/api/concept/register/pay-requests/${token}/pay`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ method }),
      });
      if (response.ok) setStep("paid");
      else if (response.status === 409) setStep("used");
      else if (response.status === 410) setStep("expired");
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="relative overflow-hidden p-5">
      <span aria-hidden className="pointer-events-none absolute inset-0 flex select-none items-center justify-center">
        <span className="-rotate-12 text-6xl font-semibold tracking-widest text-text opacity-10">{t("register.watermark")}</span>
      </span>
      <div className="relative space-y-6">
        <div className="space-y-1">
          <h1 className="text-h2 font-semibold tracking-tight">{t("pay.heading")}</h1>
          <p className="text-meta tabular-nums text-text-secondary">{t("pay.reference", { number: request.reference })}</p>
        </div>
        <dl className="border-y border-hairline py-4">
          <dt className="text-meta text-text-secondary">{t("register.due")}</dt>
          <dd className="text-h1 font-semibold tabular-nums tracking-tight">{amount}</dd>
        </dl>
        {request.methods.length > 1 && (
          <div className="space-y-2">
            <p className="text-meta font-medium">{t("register.method")}</p>
            <ChoiceCards label={t("register.method")} value={method} onChange={setMethod}
              options={request.methods.map((value) => ({ value, label: t(`register.${value}`) }))} />
          </div>
        )}
        {failed && <Notice tone="danger" role="alert">{t("pay.failed")}</Notice>}
        <div className="space-y-2">
          <Button size="lg" className="w-full" loading={busy} onClick={pay}>{t("pay.submit", { amount })}</Button>
          <p role="status" className="min-h-[1lh] text-center text-meta text-text-secondary">{busy && t("pay.confirming")}</p>
        </div>
      </div>
    </Card>
  );
}
