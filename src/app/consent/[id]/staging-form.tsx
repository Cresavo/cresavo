"use client";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/locale";
import { Button } from "@/concept/ui/button";
import { Notice } from "@/concept/ui/notice";
import { consentSequence } from "./consent-sequence";
import { consentOutcome, formatStagingTerms, parseStagingView, stagingCopy, type ConsentOutcome, type ConsentResponse, type StagingView } from "./staging-copy";

// Opening the page only reads the proposal. Nothing is approved without the explicit button.
export default function StagingConsentForm({ id, locale }: { id: string; locale: Locale }) {
  const t = stagingCopy[locale];
  const token = useRef("");
  const [sequence] = useState(consentSequence);
  const [data, setData] = useState<StagingView | null>(null);
  const [outcome, setOutcome] = useState<ConsentOutcome>("loading");
  const [busy, setBusy] = useState(false);
  const [canRecheck, setCanRecheck] = useState(false);
  const read = useRef<() => void>(() => {});
  const endpoint = `/consent/${encodeURIComponent(id)}/decision`;
  // Redirects are errors: a redirected decision is never treated as the salon's answer.
  const post = (body: object) => fetch(endpoint, { method: "POST", cache: "no-store", redirect: "error", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token.current, ...body }) });
  // Status and JSON body as received; a non-JSON body (an intermediary's page) stays undefined.
  const answer = async (r: Response): Promise<ConsentResponse> => ({ status: r.status, redirected: r.redirected,
    body: r.headers.get("content-type")?.startsWith("application/json") ? await r.json().catch(() => undefined) : undefined });
  // After an unknown outcome the secret stays in memory, so the status can be read again with it.
  const settle = (next: Exclude<ConsentOutcome, "loading">) => {
    const unknown = next === "unconfirmed" || next === "unchecked";
    if (!unknown && next !== "ready" && next !== "limited") token.current = "";
    setCanRecheck(unknown && token.current !== "");
    setOutcome(next);
  };
  useEffect(() => {
    let active = true;
    // Reads the proposal with the secret in memory. Opening, reopening the link in this tab and
    // checking the status again all come here; each waits for a decision in flight.
    const view = (fragment = "") => void sequence.read(async current => {
      if (!active) return;
      if (fragment) token.current = fragment;
      setData(null); setCanRecheck(false); setOutcome("loading");
      let response: ConsentResponse = "network-error";
      try {
        const r = await fetch(endpoint, { method: "POST", cache: "no-store", redirect: "error", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token.current, decision: "view" }) });
        response = await answer(r);
      } catch { /* reported as an unknown status below */ }
      if (!active || !current()) return;
      // Terms are rendered only after every shown and approved field has been checked.
      const next = consentOutcome("view", response);
      if (next === "ready" && response !== "network-error") setData(parseStagingView(response.body));
      settle(next);
    });
    // Keep the one-time secret in memory only and remove it from the address bar and history at
    // once, also when the link is reopened in this tab: with the same path that is only a fragment
    // change, which neither remounts the page nor re-runs this effect.
    const take = () => {
      const fragment = window.location.hash.slice(1);
      window.history.replaceState(null, "", window.location.pathname);
      return fragment;
    };
    const reopened = () => { if (window.location.hash.length > 1) view(take()); };
    read.current = () => view();
    view(take());
    window.addEventListener("hashchange", reopened);
    return () => { active = false; window.removeEventListener("hashchange", reopened); };
  }, [endpoint, sequence]);
  async function decide(decision: "yes" | "no") {
    if (!data || busy) return;
    const hash = data.proposalHash;
    setBusy(true);
    await sequence.decide(async current => {
      let response: ConsentResponse = "network-error";
      try { response = await answer(await post({ decision, proposalHash: hash })); }
      catch { /* an unknown outcome below */ }
      if (!current()) return;
      setData(null);
      settle(consentOutcome(decision, response));
    });
    setBusy(false);
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
    {canRecheck && !data && <div><Button variant="secondary" onClick={() => read.current()}>{t.recheck}</Button></div>}
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
