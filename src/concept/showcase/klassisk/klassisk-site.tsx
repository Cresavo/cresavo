"use client";

import { ShowcaseBooking, ShowcaseBookingProvider, useBook, useShowcaseMenu } from "../booking";
import { useShowcaseTheme, type ShowcaseTheme } from "../chrome";
import { ABOUT, ADDRESS, CANCEL_NOTE, CATEGORY_PERSON, MAP_URL, PEOPLE } from "../content";
import { Photo } from "../photo";
import { kronor, lunchLine, minutes, openingHours, SALON, telHref } from "../salon";
import { ThemeIcon } from "../theme-icon";
import { CLASSIC_PALETTE, CLASSIC_THEME_KEY } from "./palette";
import k from "./klassisk.module.css";

const CATEGORY_NAME: Record<string, string> = { foot: "Fotvård", massage: "Massage" };

function ThemeToggle({ theme, toggle }: { theme: ShowcaseTheme; toggle: () => void }) {
  return (
    <button type="button" className={k.icon} aria-label="Mörkt läge" aria-pressed={theme === "dark"} onClick={toggle}>
      <ThemeIcon theme={theme} />
    </button>
  );
}

function Header({ theme, toggle }: { theme: ShowcaseTheme; toggle: () => void }) {
  const book = useBook();
  return (
    <header className={k.header}>
      <div className={`${k.wrap} ${k.headerIn}`}>
        <a className={k.name} href="#top">{SALON.name}</a>
        <nav className={k.nav} aria-label="Huvudmeny">
          <a href="#behandlingar">Behandlingar</a>
          <a href="#om-oss">Om oss</a>
          <a href="#hitta-hit">Hitta hit</a>
        </nav>
        <ThemeToggle theme={theme} toggle={toggle} />
        <button type="button" className={k.book} onClick={() => book()}>Boka tid</button>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className={k.hero} id="top" aria-labelledby="hero-heading">
      <div className={`${k.wrap} ${k.heroGrid}`}>
        <div className={k.heroCopy}>
          <p className={k.where}>{ADDRESS.street} · {ADDRESS.area}</p>
          <h1 id="hero-heading" className={k.h1}>Fotvård och massage på Dalagatan.</h1>
          <p className={k.lead}>En liten salong i Vasastan. Anna är medicinsk fotterapeut och Erik masserar. Vi tar oss tid, och varje besök börjar med ett kort samtal.</p>
          <a className={k.textLink} href="#behandlingar">Se behandlingar och priser</a>
        </div>
        <Photo className={k.heroPhoto} name="klassisk-hero" eager sizes="(min-width: 960px) 58vw, 100vw"
          alt="Behandlingsrummet med en bädd under linnehanddukar, krukväxter och morgonljus från fönstret mot gatan" />
      </div>
    </section>
  );
}

function Menu() {
  const menu = useShowcaseMenu();
  const book = useBook();
  return (
    <section className={k.menu} id="behandlingar" aria-labelledby="menu-heading">
      <div className={k.wrap}>
        <header className={k.sectionHead}>
          <h2 id="menu-heading" className={k.h2}>Behandlingar och priser</h2>
          <p>Välj en behandling för att se lediga tider. {CANCEL_NOTE}</p>
        </header>
        <div className={k.menuGrid}>
          {menu.map((group) => (
            <div key={group.category} className={k.group}>
              <h3>{CATEGORY_NAME[group.category] ?? group.category}{CATEGORY_PERSON[group.category] && <span> hos {CATEGORY_PERSON[group.category]}</span>}</h3>
              <ul>
                {group.items.map((item) => (
                  <li key={item.id}>
                    <button type="button" className={k.item} onClick={() => book(item.id)}>
                      <span className={k.itemTop}>
                        <span className={k.itemName}><span className={k.srOnly}>Boka </span>{item.name}</span>
                        <span className={k.leader} aria-hidden />
                        <span className={k.price}>{kronor(item.price)}</span>
                      </span>
                      <span className={k.itemMeta}>{minutes(item.duration)} · {item.description}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section className={k.about} id="om-oss" aria-labelledby="about-heading">
      <Photo className={k.band} name="klassisk-hands" sizes="(min-width: 1200px) 1120px, 100vw"
        alt="Händer som masserar en vad med kräm efter fotbadet, med en skål vatten och handdukar intill" />
      <div className={`${k.wrap} ${k.aboutGrid}`}>
        <div className={k.aboutText}>
          <h2 id="about-heading" className={k.h2}>Om salongen</h2>
          {ABOUT.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
        <Photo className={k.aboutPhoto} name="klassisk-products" sizes="(min-width: 960px) 40vw, 100vw"
          alt="Oparfymerade krämer och oljor i bruna flaskor på en hylla bredvid vikta linnehanddukar" />
      </div>
      <div className={k.wrap}>
        <ul className={k.team} aria-label="Vi som jobbar här">
          {PEOPLE.map((person) => (
            <li key={person.id}>
              {/* The demo's staff portraits, already small. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {person.photo && <img src={person.photo} alt="" width={96} height={96} loading="lazy" />}
              <div>
                <h3>{person.name}</h3>
                <p className={k.role}>{person.title}</p>
                <p>{person.bio}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Booking({ theme }: { theme: ShowcaseTheme }) {
  return (
    <section className={k.booking} id="boka" aria-labelledby="booking-heading">
      <div className={`${k.wrap} ${k.bookingGrid}`}>
        <div className={k.bookingSide}>
          <h2 id="booking-heading" className={k.h2}>Boka tid</h2>
          <p>Välj behandling och en tid som passar. Du ser bekräftelsen direkt, och vill du hellre ringa går det också bra: <a href={telHref()}>{SALON.phone}</a>.</p>
          <Photo className={k.bookingPhoto} name="klassisk-detail" sizes="(min-width: 960px) 36vw, 0px"
            alt="Hörnet vid fönstret i salongen med en fåtölj, blommor i en vas och en morgonrock på kroken" />
        </div>
        <ShowcaseBooking className={k.flow} palette={CLASSIC_PALETTE[theme]} corners="soft" />
      </div>
    </section>
  );
}

function Hours({ className }: { className?: string }) {
  const lunch = lunchLine();
  return (
    <dl className={className}>
      {openingHours().map((line) => (
        <div key={line.days}><dt>{line.days}</dt><dd>{line.hours ?? "Stängt"}</dd></div>
      ))}
      {lunch && <div><dt>Lunch</dt><dd>{lunch}</dd></div>}
    </dl>
  );
}

function Visit() {
  return (
    <section className={k.visit} id="hitta-hit" aria-labelledby="visit-heading">
      <div className={k.wrap}>
        <h2 id="visit-heading" className={k.h2}>Hitta hit</h2>
        <div className={k.visitGrid}>
          <div>
            <h3>Adress</h3>
            <p>{ADDRESS.street}<br />{ADDRESS.city}</p>
            <a className={k.textLink} href={MAP_URL} rel="noopener">Visa på karta</a>
          </div>
          <div>
            <h3>Öppettider</h3>
            <Hours className={k.hours} />
          </div>
          <div>
            <h3>Kontakt</h3>
            <p><a className={k.plain} href={telHref()}>{SALON.phone}</a><br /><a className={k.plain} href={`mailto:${SALON.email}`}>{SALON.email}</a></p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className={k.footer}>
      <div className={`${k.wrap} ${k.footerIn}`}>
        <span>{SALON.name}</span>
        <span>{ADDRESS.street}, {ADDRESS.city}</span>
        <span>Org.nr {SALON.orgNumber}</span>
      </div>
    </footer>
  );
}

/** Salong Eko's own homepage, the calm and classic direction: light first, a serif for the voice, one way to book. */
export function KlassiskSite() {
  const { theme, toggle } = useShowcaseTheme(CLASSIC_THEME_KEY, "light");
  return (
    <ShowcaseBookingProvider>
      <div className={k.root} data-theme={theme}>
        <a className={k.skip} href="#innehall">Hoppa till innehållet</a>
        <Header theme={theme} toggle={toggle} />
        <main id="innehall">
          <Hero />
          <Menu />
          <About />
          <Booking theme={theme} />
          <Visit />
        </main>
        <Footer />
      </div>
    </ShowcaseBookingProvider>
  );
}
