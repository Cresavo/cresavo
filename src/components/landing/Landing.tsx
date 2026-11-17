import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, Check, CheckCheck, CircleUserRound, Command, Scissors, Sparkles, Ticket } from "lucide-react";
import s from "../../pages/landing.module.css";
import { BRAND } from "@/concept/brand";

const assistants = [
  { name: "Grok Bot", file: "grok-bot" },
  { name: "Muse", file: "muse" },
  { name: "OpenAI", file: "openai" },
  { name: "Claude", file: "claude" },
];
export default function Landing({ language = "sv" }: { language?: "sv" | "en" }) {
  const en = language === "en";
  const t = (sv: string, english: string) => en ? english : sv;
  const bookings = [
    { service: t("Klipp", "Haircut"), time: t("tis 14:30", "Tue 14:30"), ago: t("2 min sedan", "2 min ago") },
    { service: "Styling", time: t("ons 10:00", "Wed 10:00"), ago: t("4 min sedan", "4 min ago") },
    { service: t("Klipp", "Haircut"), time: t("tor 11:30", "Thu 11:30"), ago: t("6 min sedan", "6 min ago") },
    { service: t("Färg", "Colour"), time: t("fre 09:00", "Fri 09:00"), ago: t("8 min sedan", "8 min ago") },
  ];
  const today = ["REST API", "MCP over HTTP", t("Behörighet per registrerad klient", "Permissions per registered client"), t("Säkra omförsök", "Safe retries"), t("Skydd mot dubbelbokning", "Double-booking protection")];
  const later = [t("Kundens mandat kontrolleras på servern", "Server-side checks of customer approval"), t("Agentprov 1", "Agent trial 1"), "OAuth", t("Möjliga anslutningar efter avtal (t.ex. Valei, Bokadirekt)", "Possible agreed connections (e.g. Valei, Bokadirekt)")];

  return (
    <>
      <Head>
        <title>{t(`${BRAND.name} — från assistent till bokad tid`, `${BRAND.name} — from assistant to booked time`)}</title>
        <meta name="description" content={t(`Kopplingen mellan kundens AI-assistent och salongens bokningssystem. Följ bygget av ${BRAND.name}.`, `Connecting a customer’s AI assistant to a salon’s booking system. Follow the ${BRAND.name} build.`)} />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className={s.page} lang={language}>
        <a className={s.skip} href="#innehall">{t("Till innehållet", "Skip to content")}</a>
        <header className={s.header}>
          <a className={s.brand} href="#" aria-label={t(`${BRAND.name}, överst på sidan`, `${BRAND.name}, top of page`)}><span className={s.brandIcon}><Command size={19} /></span> {BRAND.name}</a>
          <nav className={s.languages} aria-label={t("Språk", "Language")}><Link href="/landing" lang="sv" aria-current={!en ? "page" : undefined}>SV</Link><Link href="/en/landing" lang="en" aria-current={en ? "page" : undefined}>EN</Link></nav>
        </header>
        <main id="innehall">
          <section className={s.hero} aria-labelledby="hero-title">
            <h1 id="hero-title" className={s.srOnly}>{t("Låt kundens assistent boka, säkert, inom det kunden godkänt", "Let the customer’s assistant book safely, within what the customer has approved")}</h1>
            <p className={s.tagline}>{t("Från önskemål till bokad tid.", "From request to booked time.")}</p>
            <div className={s.illustration}>
              <input className={s.motionToggle} type="checkbox" id="pause-motion" />
              <label className={s.motionLabel} htmlFor="pause-motion"><span className={s.pauseText}>{t("Pausa animation", "Pause animation")}</span><span className={s.playText}>{t("Starta animation", "Play animation")}</span></label>
              <div className={s.scene} role="img" aria-label={t("Illustrerat framtida flöde: kundens assistent skickar ett önskemål genom en mandatkontroll till salongens kalender. En syntetisk tid bokas i demo. Kundmandat är inte verifierat idag.", "Illustrated future flow: a customer’s assistant sends a request through an approval gate to the salon calendar. A synthetic slot is booked in demo. Customer approval is not verified today.")}>
                <div className={s.phone} aria-hidden="true"><span className={s.phoneNotch} /><span className={s.phoneLabel}>{t("KUNDENS ASSISTENT", "CUSTOMER’S ASSISTANT")}</span><div className={s.message}>{t("En klipptid på tisdag?", "A haircut on Tuesday?")}</div><div className={s.assistants}>{assistants.map(assistant => <div key={assistant.file} className={s.assistantRow}><span className={s.avatar}><Image unoptimized src={`/landing/logos/${assistant.file}.svg`} width={38} height={38} alt="" /></span><span>{assistant.name}</span></div>)}</div></div>
                <div className={s.bridge} aria-hidden="true"><svg viewBox="0 0 300 120" preserveAspectRatio="none"><path d="M0 90 C75 90 65 30 150 30 S225 90 300 90" /></svg><span className={s.request}><ArrowRight size={20} /></span><div className={s.gate}><Check size={24}/><strong>{t("Kundens godkännande", "Customer approval")}</strong><small>{t("Senare · illustrerad kontroll", "Later · illustrated check")}</small></div><span className={s.bridgeLabel}>{BRAND.name}</span></div>
                <div className={s.calendar} aria-hidden="true"><div className={s.calendarHeading}><CalendarDays size={21}/>{t("En dag i salongen", "A day at the salon")}</div><div className={s.calendarColumns}>{t("TISDAG / DEMO", "TUESDAY / DEMO")}</div>{["09:00", "10:00", "11:30", "14:30"].map((time, i) => <div className={s.calendarRow} key={time}><time>{time}</time><div className={i === 3 ? s.bookedSlot : s.slot}>{i === 3 ? <><Check size={15}/>{t("Bokad i demo", "Booked in demo")}</> : t("Ledig tid", "Available")}</div></div>)}<div className={s.ticket}><Ticket size={17}/> DEMO-04 · {t("bokad i demo", "booked in demo")}</div></div>
              </div>
              <p className={s.disclaimer}>{t("Illustration. Inga integrationer med dessa assistenter idag.", "Illustration. No integrations with these assistants today.")}</p>
            </div>
            <a className={s.cta} href="#folj-bygget">{t("Följ bygget", "Follow the build")} <ArrowDown size={17} /></a>
          </section>

          <section className={s.flowSection} aria-labelledby="flow-title">
            <p className={s.eyebrow}>{t("EN ENKEL VÄG FRAM OCH TILLBAKA", "A SIMPLE WAY THERE AND BACK")}</p>
            <h2 id="flow-title">{t("Från samtal till salong.", "From conversation to salon.")}</h2>
            <ol className={s.flow}>
              {[{ label: t("Kund", "Customer"), Icon: CircleUserRound }, { label: t("Assistent", "Assistant"), Icon: Sparkles }, { label: BRAND.name, Icon: Command }, { label: t("Salongens system", "Salon system"), Icon: CalendarDays }].map(({ label, Icon }, i) => (
                <li key={label}><span className={i === 2 ? s.flowIconAccent : s.flowIcon}><Icon size={25} strokeWidth={1.5} /></span><span>{label}</span>{i < 3 && <ArrowRight className={s.flowArrow} size={18} aria-hidden="true" />}</li>
              ))}
            </ol>
            <div className={s.returnPath}><span>←</span> {t("boknings-id + status", "booking ID + status")} <span>↵</span></div>
          </section>

          <section className={s.feedSection} aria-labelledby="feed-title">
            <div><p className={s.eyebrow}>{t("EN GLIMT AV FLÖDET", "A GLIMPSE OF THE FLOW")}</p><h2 id="feed-title">{t("Bokningar i rörelse.", "Bookings in motion.")}</h2><span className={s.demoLabel}><span /> {t("Demo, syntetiska data", "Demo, synthetic data")}</span></div>
            <div className={s.feedWindow}>
              <ul className={s.feed}>
                {[...bookings, ...bookings.slice(0, 2)].map((booking, i) => (
                  <li key={i} aria-hidden={i >= bookings.length ? true : undefined}><span className={s.feedIcon}><Scissors size={18} strokeWidth={1.5} /></span><div><strong>{booking.service} <span>· {booking.time}</span></strong><p>{t("bokad via assistent", "booked via assistant")} · {booking.ago}</p></div><CheckCheck size={18} className={s.feedCheck} /></li>
                ))}
              </ul>
            </div>
          </section>

          <section id="folj-bygget" className={s.progress} aria-labelledby="progress-title" tabIndex={-1}>
            <p className={s.eyebrow}>{t("FÖLJ BYGGET", "FOLLOW THE BUILD")}</p><h2 id="progress-title">{t("En tydlig riktning.", "A clear direction.")}<br /><span>{t("Ett steg i taget.", "One step at a time.")}</span></h2>
            <div className={s.progressColumns}>
              <div><h3><span className={s.statusDot} /> {t("Idag", "Today")}</h3><ul className={s.chips}>{today.map(item => <li key={item}><Check size={14} />{item}</li>)}</ul></div>
              <div><h3><span className={s.laterDot} /> {t("Senare", "Later")}</h3><ul className={s.chips}>{later.map(item => <li key={item}>{item}</li>)}</ul></div>
            </div>
          </section>

          <section className={s.protocol} aria-labelledby="protocol-title"><div><p className={s.eyebrow}>{t("ÖPPET FRÅN GRUNDEN", "OPEN FROM THE START")}</p><h2 id="protocol-title">{t("Byggt mot öppna protokoll", "Built around open protocols")}</h2></div><div className={s.protocolLinks}><a href="https://osbp.dev/">OSBP <span>{t("läs först", "read first")}</span><ArrowUpRight size={20} /></a><a href="https://usp-protocol.dev/">USP <ArrowUpRight size={20} /></a></div></section>
        </main>
        <footer className={s.footer}><span className={s.footerBrand}><Image unoptimized src="/landing/logos/grok-bot.svg" alt="Grok" width={22} height={22} /> {t("byggt med Grok Bot", "built with Grok Bot")}</span><span>{t("Läs-demo med påhittade data – inga riktiga bokningar", "Read-only demo with synthetic data — no real bookings")}</span></footer>
      </div>
    </>
  );
}
