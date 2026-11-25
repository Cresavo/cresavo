"use client";

import { ShowcaseBooking, ShowcaseBookingProvider, useBook, useShowcaseMenu } from "../booking";
import { BookBar, useShowcaseTheme, type ShowcaseTheme } from "../chrome";
import { ABOUT, ADDRESS, CANCEL_NOTE, MAP_URL, PEOPLE } from "../content";
import { Photo } from "../photo";
import { kronor, lunchLine, minutes, openingHours, SALON, telHref } from "../salon";
import { ThemeIcon } from "../theme-icon";
import { BOLD_PALETTE, BOLD_THEME_KEY } from "./palette";
import v from "./vagad.module.css";

const CATEGORY_NAME: Record<string, string> = { foot: "Fötter", massage: "Resten av kroppen" };
const CATEGORY_NOTE: Record<string, string> = { foot: "Anna, medicinsk fotterapeut", massage: "Erik, massageterapeut" };

function ThemeToggle({ theme, toggle }: { theme: ShowcaseTheme; toggle: () => void }) {
  return (
    <button type="button" className={v.icon} aria-label="Mörkt läge" aria-pressed={theme === "dark"} onClick={toggle}>
      <ThemeIcon theme={theme} />
    </button>
  );
}

function Header({ theme, toggle }: { theme: ShowcaseTheme; toggle: () => void }) {
  return (
    <header className={v.header}>
      <div className={`${v.wrap} ${v.headerIn}`}>
        <a className={v.name} href="#top">{SALON.name}</a>
        <nav className={v.nav} aria-label="Huvudmeny">
          <a href="#meny">Meny</a>
          <a href="#om-oss">Om oss</a>
          <a href="#hitta-hit">Hitta hit</a>
        </nav>
        <ThemeToggle theme={theme} toggle={toggle} />
      </div>
    </header>
  );
}

function Hero() {
  const book = useBook();
  return (
    <section className={v.hero} id="top" aria-labelledby="hero-heading">
      <div className={v.wrap}>
        <h1 id="hero-heading" className={v.h1}>Ta av dig skorna.</h1>
        <div className={v.heroRow}>
          <p className={v.lead}>Fotvård och massage på {ADDRESS.street} i {ADDRESS.area}. Anna tar hand om fötterna. Erik tar resten.</p>
          <button type="button" id="hero-boka" className={v.cta} onClick={() => book()}>Boka tid</button>
        </div>
      </div>
      <Photo className={v.heroPhoto} name="vagad-hero" eager sizes="100vw"
        alt="Behandlingsrummet med olivgröna väggar, en bädd med mörkgrönt linne och eftermiddagssol genom fönstret" />
    </section>
  );
}

function Menu() {
  const menu = useShowcaseMenu();
  const book = useBook();
  return (
    <section className={v.menu} id="meny" aria-labelledby="menu-heading">
      <div className={v.wrap}>
        <div className={v.menuHead}>
          <h2 id="menu-heading" className={v.h2}>Meny</h2>
          <p>Tryck på en behandling så visar vi första lediga tid. {CANCEL_NOTE}</p>
        </div>
        {menu.map((group) => (
          <div key={group.category} className={v.group}>
            <h3 className={v.groupName}>{CATEGORY_NAME[group.category] ?? group.category}{CATEGORY_NOTE[group.category] && <span>{CATEGORY_NOTE[group.category]}</span>}</h3>
            <ul>
              {group.items.map((item) => (
                <li key={item.id}>
                  <button type="button" className={v.item} onClick={() => book(item.id)}>
                    <span className={v.itemName}><span className={v.srOnly}>Boka </span>{item.name}</span>
                    <span className={v.itemDesc}>{item.description}</span>
                    <span className={v.itemFacts}><span>{minutes(item.duration)}</span><span>{kronor(item.price)}</span></span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function About() {
  const [intro, ...rest] = ABOUT;
  return (
    <section className={v.about} id="om-oss" aria-labelledby="about-heading">
      <div className={v.wrap}>
        <h2 id="about-heading" className={v.srOnly}>Om oss</h2>
        <p className={v.statement}>{rest[0] ?? intro}</p>
        <div className={v.collage}>
          <Photo className={v.hands} name="vagad-hands" sizes="(min-width: 900px) 58vw, 100vw"
            alt="Händer som masserar en vad, med foten vilande på en rostbrun handduk" />
          <Photo className={v.products} name="vagad-products" sizes="(min-width: 900px) 38vw, 50vw"
            alt="Massageolja i glasflaskor, en lerskål och vikta handdukar på ett gammalt träbord" />
          <Photo className={v.detail} name="vagad-detail" sizes="(min-width: 900px) 20vw, 50vw"
            alt="En terrakottafärgad vägg i salongen med en krok och skuggan av en växt i solljuset" />
        </div>
        <div className={v.aboutText}>
          <p>{intro}</p>
          {rest.slice(1).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
        <ul className={v.people} aria-label="Vi som jobbar här">
          {PEOPLE.map((person) => (
            <li key={person.id}>
              <h3>{person.name}</h3>
              <p className={v.role}>{person.title}</p>
              <p>{person.bio}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Booking({ theme }: { theme: ShowcaseTheme }) {
  return (
    <section className={v.booking} id="boka" aria-labelledby="booking-heading">
      <div className={`${v.wrap} ${v.bookingGrid}`}>
        <div className={v.bookingSide}>
          <h2 id="booking-heading" className={v.h2}>Boka en tid</h2>
          <p>Välj behandling, tid och fyll i namn och nummer. Hellre ringa? <a href={telHref()}>{SALON.phone}</a></p>
        </div>
        <ShowcaseBooking className={v.flow} palette={BOLD_PALETTE[theme]} corners="sharp" />
      </div>
    </section>
  );
}

function Visit() {
  const lunch = lunchLine();
  return (
    <section className={v.visit} id="hitta-hit" aria-labelledby="visit-heading">
      <div className={v.wrap}>
        <h2 id="visit-heading" className={v.srOnly}>Hitta hit</h2>
        <p className={v.street}>{ADDRESS.street}</p>
        <div className={v.visitGrid}>
          <div>
            <p>{ADDRESS.city} · {ADDRESS.area}</p>
            <a className={v.link} href={MAP_URL} rel="noopener">Visa på karta</a>
          </div>
          <dl className={v.hours} aria-label="Öppettider">
            {openingHours().map((line) => <div key={line.days}><dt>{line.days}</dt><dd>{line.hours ?? "Stängt"}</dd></div>)}
            {lunch && <div><dt>Lunch</dt><dd>{lunch}</dd></div>}
          </dl>
          <div>
            <a className={v.link} href={telHref()}>{SALON.phone}</a>
            <a className={v.link} href={`mailto:${SALON.email}`}>{SALON.email}</a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className={v.footer}>
      <div className={`${v.wrap} ${v.footerIn}`}>
        <span>{SALON.name}</span>
        <span>Org.nr {SALON.orgNumber}</span>
      </div>
    </footer>
  );
}

/** Salong Eko's own homepage, the bold direction: dark first, big type, the price list as the main event. */
export function VagadSite() {
  const { theme, toggle } = useShowcaseTheme(BOLD_THEME_KEY, "dark");
  return (
    <ShowcaseBookingProvider>
      <div className={v.root} data-theme={theme}>
        <a className={v.skip} href="#innehall">Hoppa till innehållet</a>
        <Header theme={theme} toggle={toggle} />
        <main id="innehall">
          <Hero />
          <Menu />
          <About />
          <Booking theme={theme} />
          <Visit />
        </main>
        <Footer />
        <BookBar className={v.bar} label="Boka tid" hero="hero-boka" />
      </div>
    </ShowcaseBookingProvider>
  );
}
