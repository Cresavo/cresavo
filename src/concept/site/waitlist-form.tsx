import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { site } from "./en";
import s from "./site.module.css";
import { BUSINESS_KINDS, EMAIL_MAX, HONEYPOT_FIELD, WAITLIST_OUTCOMES, type WaitlistOutcome } from "./waitlist";

const isOutcome = (value: unknown): value is WaitlistOutcome => WAITLIST_OUTCOMES.includes(value as WaitlistOutcome);

/**
 * The launch waiting list: one email field, an optional kind of business and the consent line.
 * It is a plain form post that also works without JavaScript (the server sends the visitor back
 * with `?waitlist=<outcome>`, passed in as `initial`); with JavaScript the answer appears in place.
 * The status line is always mounted, so screen readers announce the answer; when the answer replaces
 * the form (and the button that had focus), focus moves to it.
 */
export function WaitlistForm({ from, initial, className }: { from: string; initial?: string; className?: string }) {
  const [outcome, setOutcome] = useState<WaitlistOutcome | null>(isOutcome(initial) ? initial : null);
  const [busy, setBusy] = useState(false);
  const result = useRef<HTMLParagraphElement>(null);
  const submitted = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitted.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
      const body: unknown = await response.json().catch(() => null);
      const answer = body && typeof body === "object" && "outcome" in body ? body.outcome : null;
      // Anything unexpected (a refused request, no network) gets the same honest line: nothing was saved.
      setOutcome(isOutcome(answer) ? answer : "not-open");
    } catch {
      setOutcome("not-open");
    }
    setBusy(false);
  }

  const done = outcome === "not-open" || outcome === "added";
  useEffect(() => {
    if (done && submitted.current) result.current?.focus();
  }, [done]);
  return (
    <section id="waitlist" className={`${s.waitlist} ${className ?? ""}`} aria-labelledby="waitlist-heading">
      <h2 id="waitlist-heading">{site["waitlist.heading"]}</h2>
      <div>
      {!done && (
        <form method="post" action="/api/waitlist" onSubmit={submit} className={s.waitlistForm}>
          <input type="hidden" name="from" value={from} />
          <p className={s.honeypot} aria-hidden="true">
            <label>
              {site["waitlist.honeypot"]}
              <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" />
            </label>
          </p>
          <label className={s.field}>
            <span>{site["waitlist.email"]}</span>
            <input type="email" name="email" required maxLength={EMAIL_MAX} autoComplete="email" placeholder={site["waitlist.email.placeholder"]} aria-describedby="waitlist-consent" />
          </label>
          <label className={s.field}>
            <span>{site["waitlist.business"]}</span>
            <select name="business" defaultValue="">
              <option value="">{site["waitlist.business.none"]}</option>
              {BUSINESS_KINDS.map((kind) => <option key={kind} value={kind}>{site[`waitlist.business.${kind}`]}</option>)}
            </select>
          </label>
          <button type="submit" className={s.outlined} disabled={busy}>{site["waitlist.submit"]}</button>
        </form>
      )}
      <p ref={result} role="status" tabIndex={-1} className={s.waitlistAnswer}>{outcome && site[`waitlist.outcome.${outcome}`]}</p>
      {!done && (
        <p id="waitlist-consent" className={s.note}>
          {site["waitlist.consent"]} <Link href="/privacy">{site["waitlist.privacy"]}</Link>
        </p>
      )}
      </div>
    </section>
  );
}
