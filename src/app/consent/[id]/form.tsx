"use client";
import { useEffect, useState } from "react";
type Proposal = { contactEmailMask?: string | null; serviceName: string; staff: { name: string }; salon: string; locationId: string; start: string; durationMinutes: number; price: { amountMinor: number }; expiresAt: string };
const send = (endpoint: string, body: Record<string, unknown>) =>
  fetch(endpoint, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
// The link carries no secret: the customer proves their address with a one-time code (ADR 7).
export default function ConsentForm({ id }: { id: string }) {
  const [data, setData] = useState<{ proposal: Proposal; proposalHash: string } | null>(null);
  const [message, setMessage] = useState("Läser förslag…");
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const endpoint = `/consent/${encodeURIComponent(id)}/decision`;
  useEffect(() => {
    let active = true;
    send(endpoint, { decision: "view" })
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { if (active) { setData(d); setSentTo(d.proposal.contactEmailMask ?? null); setMessage(""); } })
      .catch(() => { if (active) setMessage("Länken är ogiltig, använd eller utgången."); });
    return () => { active = false; };
  }, [endpoint]);
  async function decide(decision: "yes" | "no" | "send-code") {
    if (!data || busy) return;
    setBusy(true);
    try {
      const r = await send(endpoint, decision === "send-code" ? { decision, email } : { decision, proposalHash: data.proposalHash, code });
      if (!r.ok) throw new Error();
      setCode("");
      if (decision === "send-code") { setSentTo((await r.json()).contactEmailMask); setMessage("En simulerad kod har skickats till labbets lokala e-postbuffert."); return; }
      setData(null);
      setMessage(decision === "yes" ? "Godkänt. Agenten kan nu slutföra exakt denna bokning. Detta är inte en bokningsbekräftelse." : "Avböjt. Inget mandat skapades.");
    } catch {
      setMessage("Kunde inte genomföra åtgärden. Kontrollera adressen (endast @example.test) eller koden. Vänta minst en minut mellan utskick; efter fem fel krävs en ny kod.");
    }
    finally { setBusy(false); }
  }
  const at = (value: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", dateStyle: "full", timeStyle: "short" }).format(new Date(value));
  return <><p>Lokalt labb – endast syntetisk kundidentitet. Inga riktiga utskick eller betalningar.</p><p role="status">{message}</p>{data && <>
    <dl>
      <dt>Tjänst</dt><dd>{data.proposal.serviceName}</dd>
      <dt>Tid (Europe/Stockholm)</dt><dd>{at(data.proposal.start)}</dd>
      <dt>Personal</dt><dd>{data.proposal.staff.name}</dd>
      <dt>Salong och plats</dt><dd>{data.proposal.salon} · {data.proposal.locationId}</dd>
      <dt>Pris</dt><dd>{new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK" }).format(data.proposal.price.amountMinor / 100)}</dd>
      <dt>Längd</dt><dd>{data.proposal.durationMinutes} minuter</dd>
      <dt>Länken går ut</dt><dd>{at(data.proposal.expiresAt)}</dd>
    </dl>
    <form onSubmit={e => { e.preventDefault(); void decide("send-code"); }}>
      <p>Bekräfta att det är du: ange din e-postadress så skickar vi en engångskod dit.</p>
      <label htmlFor="consent-email">Din e-postadress</label>{" "}
      <input id="consent-email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={e => setEmail(e.target.value)} disabled={busy} />{" "}
      <button type="submit" disabled={busy}>{sentTo ? "Skicka en ny kod" : "Skicka kod"}</button>
    </form>
    {sentTo && <form onSubmit={e => { e.preventDefault(); void decide("yes"); }}>
      <p>Koden har skickats till {sentTo}. Koden finns bara i labbets lokala e-postbuffert.</p>
      <label htmlFor="email-code">Sexsiffrig engångskod</label>{" "}
      <input id="email-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e => setCode(e.target.value)} disabled={busy} />{" "}
      <button type="submit" disabled={busy}>Ja, godkänn denna bokning</button>{" "}
      <button type="button" disabled={busy || !/^[0-9]{6}$/.test(code)} onClick={() => void decide("no")}>Nej, avböj</button>
    </form>}</>}</>;
}
