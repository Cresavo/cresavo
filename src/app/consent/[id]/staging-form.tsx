"use client";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/locale";
import { Button } from "@/concept/ui/button";
import { Notice } from "@/concept/ui/notice";
import { consentOutcome, formatStagingTerms, parseStagingView, stagingCopy, type ConsentOutcome, type ConsentResponse, type StagingView } from "./staging-copy";

// Opening the page only reads the proposal. Nothing is approved without the explicit button.
export default function StagingConsentForm({ id, locale }: { id: string; locale: Locale }) {
  const t = stagingCopy[locale];
  const token = useRef("");
  const [data, setData] = useState<StagingView | null>(null);
  const [outcome, setOutcome] = useState<ConsentOutcome>("loading");
  const [busy, setBusy] = useState(false);
  const endpoint = `/consent/${encodeURIComponent(id)}/decision`;
  // Redirects are errors: a redirected decision is never treated as the salon's answer.
  const post = (body: object) => fetch(endpoint, { method: "POST", cache: "no-store", redirect: "error", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token.current, ...body }) });
  // Status and JSON body as received; a non-JSON body (an intermediary's page) stays undefined.
  const answer = async (r: Response): Promise<ConsentResponse> => ({ status: r.status, redirected: r.redirected,
    body: r.headers.get("content-type")?.startsWith("application/json") ? await r.json().catch(() => undefined) : undefined });
  useEffect(() => {
    // Keep the one-time secret in memory only and remove it from the address bar and history.
    token.current ||= window.location.hash.slice(1);
    window.history.replaceState(null, "", window.location.pathname);
    let active = true;
    fetch(endpoint, { method: "POST", cache: "no-store", redirect: "error", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token.current, decision: "view" }) })
      .then(async r => {
        const response = await answer(r);
        if (!active) return;
        // Terms are rendered only after every shown and approved field has been checked.
        const outcome = consentOutcome("view", response);
        if (outcome === "ready" && response !== "network-error") setData(parseStagingView(response.body));
        setOutcome(outcome);
      })
      .catch(() => { if (active) setOutcome(consentOutcome("view", "network-error")); });
    return () => { active = false; };
  }, [endpoint]);
  async function decide(decision: "yes" | "no") {
    if (!data || busy) return;
    setBusy(true);
    try {
      const r = await post({ decision, proposalHash: data.proposalHash });
      setOutcome(consentOutcome(decision, await answer(r)));
    } catch { setOutcome(consentOutcome(decision, "network-error")); }
    finally { token.current = ""; setData(null); setBusy(false); }
  }
  const shown = data && formatStagingTerms(locale, data.terms.timeZone, {
    start: data.proposal.start, expiresAt: data.proposal.expiresAt,
    amountMinor: data.proposal.price.amountMinor, currency: data.terms.currency,
  });
  const rows = data && shown ? [
    ["customer", t.customer, data.customer], ["salon", t.salon, data.terms.salonName],
    ["location", t.location, t.locations[data.terms.locationId] ?? data.terms.locationName], ["service", t.service, data.proposal.serviceName],
    ["staff", t.staff, data.proposal.staff.name], ["date", t.date, shown.date], ["time", t.time, shown.time],
    ["time-zone", t.timeZone, data.terms.timeZone], ["duration", t.duration, t.minutes.replace("{n}", String(data.proposal.durationMinutes))],
    ["price", t.price, shown.price], ["currency", t.currency, data.terms.currency], ["expires", t.expires, shown.expires],
  ] : [];
  const message = outcome === "loading" ? t.loading : outcome === "ready" ? "" : t[outcome];
  return <div className="mt-4 grid max-w-xl gap-4">
    <Notice tone="info">{t.intro}</Notice>
    <p role="status" data-consent-state={outcome}>{message}</p>
    {data && <>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        {rows.map(([key, label, value]) => <div key={key} className="contents">
          <dt className="text-text-secondary">{label}</dt><dd data-term={key}>{value}</dd>
        </div>)}
      </dl>
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" disabled={busy} onClick={() => void decide("yes")}>{t.approve}</Button>
        <Button variant="secondary" disabled={busy} onClick={() => void decide("no")}>{t.decline}</Button>
      </div>
    </>}
  </div>;
}
