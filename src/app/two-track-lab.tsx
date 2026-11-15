"use client";
import { useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { demoSalons, heroChoices } from "@/lib/two-track-demo";
import { text } from "@/lib/locale";
import { formatPrice } from "@/lib/format";
import BookingForm from "./booking-form";
import { useLocale } from "./components/locale-provider";
import styles from "./two-track-lab.module.css";

type Track = "customer" | "agent";
export default function TwoTrackLab({ children, demoDate, readOnly }: { children: ReactNode; demoDate: string; readOnly: boolean }) {
  const locale = useLocale();
  const t = (en: string, sv: string) => text(locale, en, sv);
  const salons = demoSalons(locale);
  const [selected, setSelected] = useState("");
  const [track, setTrack] = useState<Track>("customer");
  const picker = useRef<HTMLElement>(null);
  const tracks = useRef<HTMLElement>(null);
  const salon = salons.find((s) => s.id === selected);
  const choices = heroChoices(locale);
  function chooseTrack(value: Track) {
    setTrack(value);
    const target = selected ? tracks.current : picker.current;
    target?.scrollIntoView({ block: "start", behavior: "auto" });
    target?.focus({ preventScroll: true });
  }
  function demoForm(agent: boolean) {
    if (!salon) return null;
    const people = salon.people.map((name, index) => ({ id: salon.id === "eko" ? (index ? "staff-erik" : "staff-demo") : `${salon.id}-${index}`, name, serviceIds: salon.services.map((s) => s.id) }));
    return <BookingForm key={`${salon.id}-${agent}`} readOnly demoSalon={salon.name} agentDemo={agent}
      presentationOnly={salon.id !== "eko" || !readOnly} services={salon.services} staff={people} initialDate={demoDate} />;
  }
  return <div className={styles.lab}>
    <section className={styles.hero}>
      <p className="eyebrow">{t("Booking Lab / fictional salons", "Booking Lab / påhittade salonger")}</p>
      <h1>{t("A little time for you.", "Lite tid för dig.")}<br /><span>{t("Two ways to find it.", "Två sätt att hitta den.")}</span></h1>
      <p>{t("Find your salon. Choose a time yourself, or explore how an agent could help — with you in control.", "Hitta din salong. Välj en tid själv, eller utforska hur en agent kan hjälpa till — med dig vid rodret.")}</p>
      <div className={styles.heroActions}>
        <button type="button" data-testid="hero-book-self" onClick={() => chooseTrack("customer")}>{choices[0]} <span aria-hidden="true">↗</span></button>
        <button type="button" data-testid="hero-book-agent" onClick={() => chooseTrack("agent")}>{choices[1]} <span aria-hidden="true">↗</span></button>
      </div>
      <p className={styles.caption}>{t(readOnly ? "Read-only demo with fictional data. No real bookings or payments." : "Synthetic demo. Only Salong Eko’s customer form saves test bookings. No real payments.", readOnly ? "Läsdemo med påhittade data. Inga riktiga bokningar eller betalningar." : "Syntetisk demo. Bara Ekos kundformulär sparar testbokningar. Inga riktiga betalningar.")}</p>
    </section>
    <section data-testid="salon-picker" className={styles.picker} ref={picker} tabIndex={-1} aria-labelledby="salon-heading">
      <p className="eyebrow">01 / {t("Find your place", "Hitta din plats")}</p>
      <h2 id="salon-heading">{t("First, a salon you like.", "Först, en salong du gillar.")}</h2>
      <p>{t("Three fictional places in Stockholm. All images are AI-generated.", "Tre påhittade platser i Stockholm. Alla bilder är AI-genererade.")}</p>
      <div className={styles.salonGrid}>{salons.map((s) => <article key={s.id} data-testid="salon-card" data-salon={s.id} className={selected === s.id ? styles.selectedSalon : styles.salon}>
        <Image src={`/demo/${s.image}`} alt={t(`Fictional ${s.name}, AI-generated demo image`, `Påhittade ${s.name}, AI-genererad demobild`)} width={720} height={480} unoptimized />
        <div><p className="eyebrow">Stockholm · {s.area}</p><h3>{s.name}</h3><p>{s.description}</p>
          <ul>{s.services.map((service) => <li key={service.id}>{service.name}<span>{service.duration} min · {formatPrice(service.priceOre, locale)}</span></li>)}</ul>
          {s.id === "eko" && <p className={styles.caption}>{t("Mon–Fri: Anna 09–17, Erik 10–16. Stockholm time.", "Mån–fre: Anna 09–17, Erik 10–16. Svensk tid.")}</p>}
          <button type="button" aria-pressed={selected === s.id} onClick={() => { setSelected(s.id); tracks.current?.scrollIntoView({ block: "start" }); tracks.current?.focus({ preventScroll: true }); }}>{selected === s.id ? t("Selected", "Vald") : t("Choose salon", "Välj salong")} <span aria-hidden="true">→</span></button>
        </div>
      </article>)}</div>
    </section>
    <section data-testid="tracks" className={styles.tracks} ref={tracks} tabIndex={-1} aria-labelledby="tracks-heading">
      <p className="eyebrow">02 / {t("Choose your way", "Välj din väg")}</p>
      <h2 id="tracks-heading">{salon ? salon.name : t("Your visit starts here.", "Ditt besök börjar här.")}</h2>
      {salon ? <div className={styles.selectedSummary}><p>{salon.area} · {t("Both paths are available below. All times use Europe/Stockholm.", "Båda spåren finns nedan. Alla tider i Europe/Stockholm.")}</p><button type="button" className="secondary" onClick={() => { setSelected(""); picker.current?.focus(); }}>{t("Choose another salon", "Välj en annan salong")}</button></div> : <p role="status">{t("Choose a salon above before you can book or approve a proposal.", "Välj en salong ovan innan du kan boka eller godkänna ett förslag.")}</p>}
      <div data-testid="track-tabs" className={styles.tabs} role="tablist" aria-label={t("Booking paths", "Bokningsspår")}>
        {(["customer", "agent"] as const).map((value, i) => <button key={value} type="button" role="tab" id={`tab-${value}`} aria-selected={track === value} aria-controls={`panel-${value}`} tabIndex={track === value ? 0 : -1} onKeyDown={(event) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); const next = event.key === "Home" ? "customer" : event.key === "End" ? "agent" : value === "customer" ? "agent" : "customer"; setTrack(next); document.getElementById(`tab-${next}`)?.focus(); }
        }} onClick={() => setTrack(value)}>{choices[i]}</button>)}
      </div>
      <div className={styles.columns} data-active={track}>
        <section id="panel-customer" data-testid="track-customer" className={styles.customer} role="tabpanel" aria-labelledby="customer-title">
          <div className={styles.trackHeading}><span>01 / {t("At your own pace", "I din egen takt")}</span><h2 id="customer-title">{choices[0]}</h2><p>{t("Treatment, person, day. Find a time that feels right.", "Behandling, person, dag. Hitta en tid som passar dig.")}</p></div>
          <fieldset disabled={!salon} className={styles.gate} hidden={!salon}><legend className="sr-only">{choices[0]}</legend>
            <div key={selected} hidden={selected !== "eko"}>{children}</div>
            {selected !== "eko" && demoForm(false)}
          </fieldset>
        </section>
        <section id="panel-agent" data-testid="track-agent" className={styles.agent} role="tabpanel" aria-labelledby="agent-title">
          <div className={styles.trackHeading}><span>02 / {t("With a little help", "Med lite hjälp")}</span><h2 id="agent-title">{choices[1]}</h2><p>{t("Your agent proposes. You decide. Payment is a separate simulation.", "Din agent föreslår. Du bestämmer. Betalning är en separat simulering.")}</p></div>
          <ol className={styles.steps} aria-label={t("Agent demo steps", "Agentdemons steg")}><li>{t("Agent proposes a visit", "Agenten föreslår ett besök")}</li><li>{t("You say Yes or No", "Du säger Ja eller Nej")}</li><li>{t("Simulated prepayment after Yes", "Simulerad förskottsbetalning efter Ja")}</li></ol>
          <fieldset className={styles.gate} disabled={!salon} hidden={!salon}><legend className="sr-only">{choices[1]}</legend><div data-testid="agent-step"><h3>1. {t("Explore a proposal", "Utforska ett förslag")}</h3><p>{t("Local agent demo. Choose the visit to propose below. No external agent is connected.", "Lokal agentdemo. Välj besöket att föreslå nedan. Ingen extern agent är ansluten.")}</p>{demoForm(true)}</div></fieldset>
        </section>
      </div>
      {!readOnly && <p>{t("Salong Eko uses the existing booking form. Other salons and the agent path are local simulations.", "Salong Eko använder befintligt bokningsformulär. Övriga salonger och agentspåret är lokala simuleringar.")}</p>}
      <p className={styles.caption}>{t("Fictional demonstration · No email or SMS · No real payment", "Påhittad demonstration · Inga mejl eller SMS · Ingen riktig betalning")}</p>
    </section>
  </div>;
}

