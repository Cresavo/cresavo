"use client";
import { useEffect, useRef, useState } from "react";
import type { LiveEvent, LiveSnapshot } from "@/lib/agent-api/live";
import type { Locale } from "@/lib/locale";
import s from "./live.module.css";
import { Wordmark } from "@/concept/ui/wordmark";

const POLL_MS = 4000;
const ZONE = "Europe/Stockholm";

function useText(locale: Locale) {
  return (en: string, sv: string) => (locale === "en" ? en : sv);
}

function fmt(locale: Locale, iso: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "sv-SE", { timeZone: ZONE, ...opts }).format(new Date(iso));
}

function relative(locale: Locale, iso: string, now: number) {
  const sec = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  const rtf = new Intl.RelativeTimeFormat(locale === "en" ? "en" : "sv", { numeric: "auto", style: "short" });
  if (sec < 45) return locale === "en" ? "just now" : "nyss";
  if (sec < 3600) return rtf.format(-Math.round(sec / 60), "minute");
  if (sec < 86400) return rtf.format(-Math.round(sec / 3600), "hour");
  return rtf.format(-Math.round(sec / 86400), "day");
}

const PROVENANCE: Record<LiveEvent["provenance"], { en: string; sv: string; hintEn: string; hintSv: string }> = {
  "verified-agent-proof": {
    en: "Verified agent proof", sv: "Verifierat agentprov",
    hintEn: "Operator label; independent proof requires a linked review report.", hintSv: "Operatörsetikett; oberoende bevis kräver en tillhörande granskningsrapport.",
  },
  "registered-client": {
    en: "Registered API client", sv: "Registrerad API-klient",
    hintEn: "A named key with a responsible owner. The client is not independently verified.",
    hintSv: "En namngiven nyckel med ansvarig ägare. Klienten är inte oberoende verifierad.",
  },
  "demo-script": {
    en: "Demo script", sv: "Demoskript",
    hintEn: "Scripted traffic that exercises the API. Not an AI agent.", hintSv: "Skriptad trafik som provar API:t. Inte en AI-agent.",
  },
};

function outcomeLabel(t: ReturnType<typeof useText>, e: LiveEvent) {
  switch (e.outcome) {
    case "booked": return { label: t("Booked", "Bokad"), tone: s.toneOk };
    case "replayed": return { label: t("Safe retry", "Säkert nytt försök"), tone: s.toneInfo };
    case "conflict": return { label: t("Conflict handled", "Krock hanterad"), tone: s.toneWarn };
    case "cancelled": return { label: t("Cancelled", "Avbokad"), tone: s.toneMuted };
    case "stale_service": return { label: t("Stale service", "Inaktuell tjänst"), tone: s.toneWarn };
    case "rate_limited": return { label: t("Rate limited", "Begränsad"), tone: s.toneWarn };
    default: return { label: e.outcome, tone: s.toneMuted };
  }
}

function sentence(t: ReturnType<typeof useText>, locale: Locale, e: LiveEvent) {
  const what = e.serviceName ?? t("a service", "en behandling");
  const who = e.staffName ? t(` with ${e.staffName}`, ` hos ${e.staffName}`) : "";
  const when = e.slot ? fmt(locale, e.slot, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  if (e.action === "cancel") return { verb: t("cancelled", "avbokade"), what: `${what}${who}`, when };
  if (e.outcome === "conflict") return { verb: t("tried to book", "försökte boka"), what: `${what}${who}`, when };
  if (e.outcome === "replayed") return { verb: t("retried booking", "upprepade bokningen av"), what: `${what}${who}`, when };
  return { verb: t("booked", "bokade"), what: `${what}${who}`, when };
}

export function LiveBoard({ initial, locale }: { initial: LiveSnapshot | null; locale: Locale }) {
  const t = useText(locale);
  const [data, setData] = useState(initial);
  const [online, setOnline] = useState(initial !== null);
  const [now, setNow] = useState(() => (initial ? new Date(initial.generatedAt).getTime() : 0));
  const seen = useRef(new Set(initial?.events.map((e) => e.id) ?? []));
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/v1/live", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const next = (await res.json()) as LiveSnapshot;
        if (stop) return;
        const added = next.events.filter((e) => !seen.current.has(e.id)).map((e) => e.id);
        added.forEach((id) => seen.current.add(id));
        if (added.length) setFresh(new Set(added));
        setData(next);
        setOnline(true);
      } catch {
        if (!stop) setOnline(false);
      }
      if (!stop) setNow(Date.now());
    };
    const timer = setInterval(tick, POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), 15000);
    queueMicrotask(() => setNow(Date.now()));
    return () => { stop = true; clearInterval(timer); clearInterval(clock); };
  }, []);

  const stats = data?.stats ?? { booked: 0, conflictsHandled: 0, cancelled: 0, activeKeys: 0 };
  const cards = [
    { value: stats.booked, label: t("Bookings made", "Bokade tider"), note: t("Created through the agent API", "Skapade via agent-API:t") },
    { value: stats.conflictsHandled, label: t("Conflicts handled", "Krockar hanterade"), note: t("Double bookings refused by the engine", "Dubbelbokningar som motorn stoppade") },
    { value: stats.cancelled, label: t("Cancellations", "Avbokningar"), note: t("Only by the owning client", "Bara av klienten som äger bokningen") },
    { value: stats.activeKeys, label: t("Active API keys", "Aktiva API-nycklar"), note: t("One key is not necessarily one AI agent", "En nyckel är inte nödvändigtvis en AI-agent") },
  ];

  return (
    <main className={s.page} data-live-page>
      <header className={s.top}>
        <div className={s.brand}>
          <Wordmark className="w-[104px]" />
          <span className={s.tag}>{t("Agent sandbox", "Agentsandlåda")}</span>
        </div>
        <div className={`${s.status} ${online ? "" : s.statusOff}`} role="status">
          <span className={s.pulse} aria-hidden />
          {online ? (
            <span>
              Live<span className={s.statusLong}>{t(" · refreshes every 4 s", " · uppdateras var 4:e sekund")}</span>
            </span>
          ) : (
            t("Reconnecting…", "Återansluter…")
          )}
        </div>
      </header>

      <section className={s.hero}>
        <p className={s.eyebrow}>{t("Sandbox · synthetic data only", "Sandlåda · endast påhittad data")}</p>
        <h1 className={s.title}>
          {t("Watch AI agents book", "Se AI-\u2060agenter boka")}{" "}
          <span className={s.titleSoft}>{t("as it happens.", "medan det händer.")}</span>
        </h1>
        <p className={s.lede}>
          {t(
            "Recorded sandbox outcomes, shown on a best-effort basis. This is not an audit log. Use booking id and status to check the actual result. Synthetic data only.",
            "Registrerade sandlådeutfall visas när de kunnat sparas. Detta är ingen revisionslogg. Kontrollera verkligt resultat med boknings-id och status. Endast påhittade uppgifter.",
          )}
        </p>
      </section>

      <section className={s.stats} aria-label={t("Totals", "Totalt")}>
        {cards.map((c) => (
          <div key={c.label} className={s.stat}>
            <div className={s.statValue}>{c.value.toLocaleString(locale === "en" ? "en-GB" : "sv-SE")}</div>
            <div className={s.statLabel}>{c.label}</div>
            <div className={s.statNote}>{c.note}</div>
          </div>
        ))}
      </section>

      <div className={s.grid}>
        <section className={s.feed} aria-labelledby="feed-title">
          <div className={s.feedHead}>
            <h2 id="feed-title" className={s.h2}>{t("Latest agent activity", "Senaste agentaktivitet")}</h2>
            <span className={s.muted}>{t("Salong Eko · Europe/Stockholm", "Salong Eko · Europe/Stockholm")}</span>
          </div>
          {!data && <p className={s.empty}>{t("The feed is unavailable right now.", "Flödet är inte tillgängligt just nu.")}</p>}
          {data && data.events.length === 0 && (
            <div className={s.empty}>
              <strong>{t("No agent bookings yet", "Inga agentbokningar ännu")}</strong>
              <span>{t("Create a key and let your agent book a slot — it shows up here within seconds.", "Skapa en nyckel och låt din agent boka en tid – den syns här inom några sekunder.")}</span>
            </div>
          )}
          <ol className={s.list}>
            {data?.events.map((e) => {
              const o = outcomeLabel(t, e);
              const line = sentence(t, locale, e);
              return (
                <li key={e.id} className={`${s.row} ${fresh.has(e.id) ? s.rowFresh : ""}`}>
                  <div className={s.when}>
                    <time dateTime={e.at}>{fmt(locale, e.at, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
                    <span>{now ? relative(locale, e.at, now) : ""}</span>
                  </div>
                  <div className={s.body}>
                    <div className={s.who}>
                      <span className={s.agent}>{e.agentName}</span>
                      <span className={`${s.badge} ${s[`prov_${e.provenance.replace(/-/g, "_")}`]}`}>
                        {locale === "en" ? PROVENANCE[e.provenance].en : PROVENANCE[e.provenance].sv}
                      </span>
                    </div>
                    <p className={s.what}>
                      <span className={s.verb}>{line.verb}</span> {line.what}
                      {line.when && <span className={s.slot}>{line.when}</span>}
                    </p>
                  </div>
                  <span className={`${s.pill} ${o.tone}`}>{o.label}</span>
                </li>
              );
            })}
          </ol>
        </section>

        <aside className={s.side}>
          <section className={s.panel}>
            <h2 className={s.h3}>{t("Provenance", "Proveniens")}</h2>
            <p className={s.panelLede}>{t("Each key is labelled by how much we actually know about the client behind it.", "Varje nyckel märks efter hur mycket vi faktiskt vet om klienten bakom den.")}</p>
            <ul className={s.legend}>
              {(["verified-agent-proof", "registered-client", "demo-script"] as const).map((p) => (
                <li key={p}>
                  <span className={`${s.dot} ${s[`prov_${p.replace(/-/g, "_")}`]}`} aria-hidden />
                  <div>
                    <div className={s.legendTitle}>
                      {locale === "en" ? PROVENANCE[p].en : PROVENANCE[p].sv}
                      <span className={s.count}>{data?.byProvenance[p] ?? 0}</span>
                    </div>
                    <div className={s.legendHint}>{locale === "en" ? PROVENANCE[p].hintEn : PROVENANCE[p].hintSv}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section className={s.panel}>
            <h2 className={s.h3}>{t("Connect an agent", "Koppla in en agent")}</h2>
            <ol className={s.steps}>
              <li>{t("Get a sandbox key tied to an agent name and a responsible person.", "Skaffa en sandlådenyckel kopplad till ett agentnamn och en ansvarig person.")}</li>
              <li>{t("Read services and availability, then book with an Idempotency-Key.", "Läs tjänster och lediga tider, boka sedan med en Idempotency-Key.")}</li>
              <li>{t("Or connect over MCP — same rules, same key.", "Eller anslut via MCP – samma regler, samma nyckel.")}</li>
            </ol>
            <pre className={s.code}><code>{`GET  /api/v1/services
GET  /api/v1/availability
POST /api/v1/bookings
GET  /api/v1/bookings/{id}
POST /api/v1/bookings/{id}/cancel
MCP  /api/v1/mcp`}</code></pre>
          </section>
          <p className={s.fine}>
            {t(
              "Shown here: agent label, provenance, service, staff first name and time. Never customer details, owner contact or keys.",
              "Här visas: agentnamn, proveniens, behandling, personalens förnamn och tid. Aldrig kunduppgifter, ägarens kontakt eller nycklar.",
            )}
          </p>
        </aside>
      </div>
    </main>
  );
}
