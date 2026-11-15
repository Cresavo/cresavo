"use client";
import { useEffect, useRef, useState } from "react";
type Proposal = { serviceName: string; staff: { name: string }; salon: string; locationId: string; start: string; durationMinutes: number; price: { amountMinor: number }; expiresAt: string };
export default function ConsentForm({ id }: { id: string }) {
  const token = useRef("");
  const [data, setData] = useState<{ proposal: Proposal; proposalHash: string; customer: string } | null>(null);
  const [message, setMessage] = useState("Läser förslag…");
  const [busy, setBusy] = useState(false);
  const endpoint = `/consent/${encodeURIComponent(id)}/decision`;
  useEffect(() => {
    token.current ||= window.location.hash.slice(1);
    window.history.replaceState(null, "", window.location.pathname);
    let active = true;
    fetch(endpoint, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token.current, decision: "view" }) })
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { if (active) { setData(d); setMessage(""); } })
      .catch(() => { if (active) setMessage("Länken är ogiltig, använd eller utgången."); });
    return () => { active = false; };
  }, [endpoint]);
  async function decide(decision: "yes" | "no") {
    if (!data || busy) return;
    setBusy(true);
    try {
      const r = await fetch(endpoint, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token.current, decision, proposalHash: data.proposalHash }) });
      if (!r.ok) throw new Error();
      setMessage(decision === "yes" ? "Godkänt. Agenten kan nu slutföra exakt denna bokning. Detta är inte en bokningsbekräftelse." : "Avböjt. Inget mandat skapades.");
    } catch { setMessage("Länken är ogiltig, använd eller utgången. Kontrollera status hos agenten."); }
    finally { token.current = ""; setData(null); setBusy(false); }
  }
  const at = (value: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", dateStyle: "full", timeStyle: "short" }).format(new Date(value));
  return <><p>Lokalt labb – endast syntetisk kundidentitet. Inga utskick eller betalningar.</p><p role="status">{message}</p>{data && <>
    <p>{data.customer}</p><dl>
      <dt>Tjänst</dt><dd>{data.proposal.serviceName}</dd>
      <dt>Tid (Europe/Stockholm)</dt><dd>{at(data.proposal.start)}</dd>
      <dt>Personal</dt><dd>{data.proposal.staff.name}</dd>
      <dt>Salong och plats</dt><dd>{data.proposal.salon} · {data.proposal.locationId}</dd>
      <dt>Pris</dt><dd>{new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK" }).format(data.proposal.price.amountMinor / 100)}</dd>
      <dt>Längd</dt><dd>{data.proposal.durationMinutes} minuter</dd>
      <dt>Länken går ut</dt><dd>{at(data.proposal.expiresAt)}</dd>
    </dl><form onSubmit={e => { e.preventDefault(); void decide("yes"); }}>
      <button type="submit" disabled={busy}>Ja, godkänn denna bokning</button>{" "}
      <button type="button" disabled={busy} onClick={() => void decide("no")}>Nej, avböj</button>
    </form></>}</>;
}
