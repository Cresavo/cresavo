"use client";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/locale";
import { Button } from "@/concept/ui/button";
import { Notice } from "@/concept/ui/notice";
import { consentSequence } from "./consent-sequence";
import { consentRequest } from "./consent-request";
import { consentFragment, consentOutcome, recheckable, formatStagingTerms, parseStagingView, stagingCopy, type ConsentOutcome, type StagingView } from "./staging-copy";

// Opening the page only reads the proposal. Nothing is approved without the explicit button.
export default function StagingConsentForm({ id, locale, origin }: { id: string; locale: Locale; origin: string }) {
  const t = stagingCopy[locale];
  const token = useRef("");
  const [sequence] = useState(consentSequence);
  const [data, setData] = useState<StagingView | null>(null);
  const [outcome, setOutcome] = useState<ConsentOutcome>("loading");
  const [busy, setBusy] = useState(false);
  const [canRecheck, setCanRecheck] = useState(false);
  // While the salon's Retry-After runs, the recheck is offered but not yet enabled.
  const [waiting, setWaiting] = useState(false);
  const retry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const read = useRef<() => void>(() => {});
  const endpoint = `/consent/${encodeURIComponent(id)}/decision`;
  // Redirects are errors, and every request has a deadline that covers its body (consent-request.ts).
  const post = (body: object) => consentRequest(endpoint, { token: token.current, ...body });
  // After an unknown outcome the secret stays in memory, so the status can be read again with it.
  // `retryAfter` comes from the same response as `next`, applied only when that request is current.
  const settle = (next: Exclude<ConsentOutcome, "loading">, retryAfter = 0) => {
    if (!recheckable(next) && next !== "ready") token.current = "";
    setCanRecheck(recheckable(next) && token.current !== "");
    clearTimeout(retry.current);
    const wait = next === "limited" ? retryAfter : 0;
    setWaiting(wait > 0);
    if (wait > 0) retry.current = setTimeout(() => setWaiting(false), wait * 1000);
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
      const { response, retryAfter } = await consentRequest(endpoint, { token: token.current, decision: "view" });
      if (!active || !current()) return;
      // Terms are rendered only after every shown and approved field has been checked.
      const next = consentOutcome("view", response);
      if (next === "ready" && response !== "network-error") setData(parseStagingView(response.body));
      settle(next, retryAfter);
    });
    // Keep the one-time secret in memory only and remove it from the address bar and history at
    // once, also when the link is reopened in this tab: with the same path that is only a fragment
    // change, which neither remounts the page nor re-runs this effect.
    // The secret is read only on the configured consent origin; elsewhere it is removed from the
    // address bar unread and nothing is sent.
    const take = () => {
      const fragment = consentFragment(origin, window.location);
      window.history.replaceState(null, "", window.location.pathname);
      return fragment;
    };
    const open = () => {
      const fragment = take();
      if (fragment === null) { token.current = ""; setData(null); setCanRecheck(false); setOutcome("wrongOrigin"); return; }
      view(fragment);
    };
    const reopened = () => { if (window.location.hash.length > 1) open(); };
    read.current = () => view();
    open();
    window.addEventListener("hashchange", reopened);
    return () => { active = false; clearTimeout(retry.current); window.removeEventListener("hashchange", reopened); };
  }, [endpoint, sequence, origin]);
  async function decide(decision: "yes" | "no") {
    if (!data || busy) return;
    const hash = data.proposalHash;
    setBusy(true);
    await sequence.decide(async current => {
      const { response, retryAfter } = await post({ decision, proposalHash: hash });
      if (!current()) return;
      setData(null);
      settle(consentOutcome(decision, response), retryAfter);
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
    {canRecheck && !data && <div><Button variant="secondary" disabled={waiting} onClick={() => read.current()}>{t.recheck}</Button></div>}
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
