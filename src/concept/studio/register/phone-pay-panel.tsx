"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { QrCode } from "../../account/two-step/qr-code";
import type { RegisterMethod } from "../../connections/ports/register";
import { getActiveLocale, locale, t, type MessageKey } from "../../i18n";
import { Button } from "../../ui/button";
import { Notice } from "../../ui/notice";

type PhoneMethod = Exclude<RegisterMethod, "cash">;
interface PayRequest {
  token: string;
  expiresAt: number;
}
/** `unknown`: the server cannot read this code (another instance with its own key); only a new code helps. */
type Phase = { step: "creating" } | { step: "waiting" | "expired" | "unknown"; request: PayRequest } | { step: "failed" };
type Ended = Exclude<Phase["step"], "creating" | "waiting">;
const ENDED: Record<Ended, { tone: "danger" | "info"; text: MessageKey; action: MessageKey }> = {
  failed: { tone: "danger", text: "register.phoneFailed", action: "register.phoneRetry" },
  expired: { tone: "info", text: "register.phoneExpired", action: "register.phoneNew" },
  unknown: { tone: "info", text: "register.phoneUnknown", action: "register.phoneNew" },
};

const POLL_MS = 2000;
const API = "/api/concept/register/pay-requests";
const savedKey = (paymentId: string) => `cresavo-demo-register-pay-${paymentId}`;

/** The request this tab already shows for the payment, so a reload keeps the code the customer may have scanned. */
function savedRequest(paymentId: string): PayRequest | undefined {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(savedKey(paymentId)) ?? "null") as Partial<PayRequest> | null;
    return saved && typeof saved.token === "string" && typeof saved.expiresAt === "number" && saved.expiresAt > Date.now() ? { token: saved.token, expiresAt: saved.expiresAt } : undefined;
  } catch {
    return undefined;
  }
}

function remember(paymentId: string, request: PayRequest | null) {
  try {
    if (request) window.sessionStorage.setItem(savedKey(paymentId), JSON.stringify(request));
    else window.sessionStorage.removeItem(savedKey(paymentId));
  } catch {
    // Blocked storage: the code lives as long as this panel.
  }
}

/**
 * Shown while a payment waits for the customer's phone: a QR code to the
 * payment page, asked about every two seconds until it is paid or has expired.
 * The request carries the amount and the business, nothing about the customer.
 */
export function PhonePayPanel({ paymentId, business, workspace, amountMinor, amount, currency, methods, onPaid }: {
  paymentId: string;
  business: string;
  workspace: string;
  amountMinor: number;
  /** The amount as shown in the register. */
  amount: string;
  currency: string;
  methods: PhoneMethod[];
  onPaid: (method: PhoneMethod) => void;
}) {
  const [phase, setPhase] = useState<Phase>({ step: "creating" });
  const [attempt, setAttempt] = useState(0);
  const paid = useEffectEvent((method: PhoneMethod) => {
    remember(paymentId, null);
    onPaid(method);
  });
  const offered = methods.join(",");

  useEffect(() => {
    let live = true;
    const create = async () => {
      const saved = attempt === 0 ? savedRequest(paymentId) : undefined;
      if (saved) return setPhase({ step: "waiting", request: saved });
      try {
        const response = await fetch(API, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ business, workspace, amountMinor, currency, methods: offered.split(",") }),
        });
        if (!response.ok) throw new Error("refused");
        const request = (await response.json()) as PayRequest;
        if (!live) return;
        remember(paymentId, request);
        setPhase({ step: "waiting", request });
      } catch {
        if (live) setPhase({ step: "failed" });
      }
    };
    void create();
    return () => {
      live = false;
    };
  }, [attempt, paymentId, business, workspace, amountMinor, currency, offered]);

  const request = phase.step === "waiting" ? phase.request : undefined;
  useEffect(() => {
    if (!request) return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      let status: { status?: string; method?: PhoneMethod } = {};
      try {
        const response = await fetch(`${API}/${request.token}`, { signal: abort.signal, cache: "no-store" });
        // 404: the server cannot read this code, so polling on would only wait for it to expire.
        if (response.status === 404) status = { status: "unknown" };
        else if (response.ok) status = await response.json();
      } catch {
        // Offline for a moment: ask again.
      }
      if (abort.signal.aborted) return;
      if (status.status === "paid" && status.method) return paid(status.method);
      if (status.status === "unknown") return setPhase({ step: "unknown", request });
      if (status.status === "expired" || Date.now() >= request.expiresAt) return setPhase({ step: "expired", request });
      timer = setTimeout(poll, POLL_MS);
    };
    timer = setTimeout(poll, POLL_MS);
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [request]);

  const again = () => {
    remember(paymentId, null);
    setPhase({ step: "creating" });
    setAttempt((n) => n + 1);
  };

  if (phase.step !== "creating" && phase.step !== "waiting") {
    const ended = ENDED[phase.step];
    return (
      <section className="space-y-3 border-t border-hairline pt-4">
        <h3 className="text-body font-semibold">{t("register.phoneTitle")}</h3>
        <Notice tone={ended.tone} role={ended.tone === "danger" ? "alert" : "status"}>{t(ended.text)}</Notice>
        <Button variant="secondary" onClick={again}>{t(ended.action)}</Button>
      </section>
    );
  }

  const url = request ? `${window.location.origin}/betala/demo/${request.token}?lang=${getActiveLocale()}` : "";
  const until = request ? new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(request.expiresAt) : "";
  return (
    <section className="space-y-3 border-t border-hairline pt-4">
      <h3 className="text-body font-semibold">{t("register.phoneTitle")}</h3>
      <p className="text-text-secondary">{t("register.phoneScan", { amount })}</p>
      <div className="flex min-h-64 flex-col items-center justify-center gap-3">
        {request ? (
          <>
            <QrCode value={url} label={t("register.phoneQr")} size="lg" />
            <p role="status" className="text-center text-meta text-text-secondary">{t("register.phoneWaiting", { time: until })}</p>
            <a href={url} target="_blank" rel="noreferrer" className="block max-w-full truncate text-meta text-text-secondary underline underline-offset-2 hover:text-text">
              {url.replace(/^https?:\/\//, "").replace(/\?.*$/, "")}
            </a>
          </>
        ) : (
          <span role="status" aria-label={t("register.phoneCreating")} className="ui-spinner size-6 rounded-full border-2 border-current border-r-transparent text-text-secondary" />
        )}
      </div>
    </section>
  );
}
