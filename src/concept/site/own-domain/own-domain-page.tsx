import Image from "next/image";
import { CONTACT_EMAIL } from "../../brand";
import { Wordmark } from "../../ui/wordmark";
import { bookingHome } from "../../booking/links";
import { useSiteCopy } from "../copy";
import { sitePath } from "../language";
import { SiteHead } from "../site-head";
import { HomeFooter } from "../home/home-sections";
import { Icon } from "../home/icons";
import { list } from "../home/text";
import { useHomeTheme } from "../home/use-home-theme";
import { ButtonBuilder, CopyCode } from "./button-builder";
import { DEMO_SLUG, embedSnippet, exampleRecord } from "./snippets";
import type { OwnDomainProps } from "./props";
import h from "../home/home.module.css";
import o from "./own-domain.module.css";

const fillHost = (text: string, host: string) => text.replace("{host}", host);

function Header({ theme, onTheme }: { theme: string; onTheme: () => void }) {
  const { site, locale } = useSiteCopy();
  const other = locale === "sv" ? "en" : "sv";
  return (
    <header className={h.header}>
      <div className={`${h.wrap} ${h.headerIn}`}>
        <a className={h.brand} href={sitePath(locale)} aria-label={site["landing.home"]}><Wordmark label="" /></a>
        <a className={o.lang} href={sitePath(other, "own-domain")} lang={other} hrefLang={other}>{site["home.lang"]}</a>
        <button className={`${h.themeBtn} ${o.theme}`} type="button" aria-label={site["home.theme"]} aria-pressed={theme === "dark"} onClick={onTheme}>
          <Icon name="moon" className={`${h.ic} ${h.moon}`} />
          <Icon name="sun" className={`${h.ic} ${h.sun}`} />
        </button>
      </div>
    </header>
  );
}

/** The demo salon's real booking page, captured from /boka/salong-eko, in a browser and on a phone at an invented address. */
function Example({ booking }: { booking: string }) {
  const { site, locale } = useSiteCopy();
  const host = site["domain.example.host"];
  return (
    <figure className={o.example}>
      <div className={o.frames}>
        <div className={o.browser}>
          <p className={o.bar} aria-hidden><span className={o.lock} />{host}</p>
          <Image src={`/site/own-domain/booking-desktop-${locale}.webp`} alt={fillHost(site["domain.example.desktop"], host)} width={1920} height={1200} unoptimized priority />
        </div>
        <div className={o.phone}>
          <p className={o.phoneBar} aria-hidden>{host}</p>
          <Image src={`/site/own-domain/booking-phone-${locale}.webp`} alt={site["domain.example.phone"]} width={780} height={1560} unoptimized priority />
        </div>
      </div>
      <figcaption className={o.caption}>
        {site["domain.example"]} <a className={h.inline} href={booking}>{site["domain.example.open"]}</a>
      </figcaption>
    </figure>
  );
}

function Ways({ bookingOrigin }: { bookingOrigin: string }) {
  const { site, locale } = useSiteCopy();
  const record = exampleRecord(site["domain.example.host"]);
  const embed = embedSnippet(bookingOrigin, locale);
  return (
    <section className={o.ways} aria-labelledby="ways-heading">
      <div className={h.wrap}>
        <h2 id="ways-heading">{site["domain.ways.heading"]}</h2>
        <div className={o.waysGrid}>
          <article className={o.way} aria-labelledby="way-address">
            <h3 id="way-address">{site["domain.address.heading"]}</h3>
            <p>{site["domain.address.text"]}</p>
            <dl className={o.record} aria-label={fillHost(site["domain.address.caption"], record.host)}>
              <div><dt>{site["domain.address.type"]}</dt><dd>{record.type}</dd></div>
              <div><dt>{site["domain.address.name"]}</dt><dd>{record.name}</dd></div>
              <div><dt>{site["domain.address.value"]}</dt><dd>{record.value}</dd></div>
            </dl>
            <p className={o.small}>{fillHost(site["domain.address.caption"], record.host)}</p>
          </article>
          <article className={o.way} aria-labelledby="way-button">
            <h3 id="way-button">{site["domain.button.heading"]}</h3>
            <p>{site["domain.button.text"]}</p>
            <ButtonBuilder origin={bookingOrigin} />
          </article>
          <article className={o.way} aria-labelledby="way-embed">
            <h3 id="way-embed">{site["domain.embed.heading"]}</h3>
            <p>{site["domain.embed.text"]}</p>
            <CopyCode label={site["domain.embed.code"]} code={embed.code} />
            <a className={h.textLink} href={embed.widget}>{site["domain.embed.open"]} <Icon name="arrow" className={h.ic} /></a>
          </article>
        </div>
      </div>
    </section>
  );
}

function Owned() {
  const { site } = useSiteCopy();
  return (
    <section className={o.owned} aria-labelledby="owned-heading">
      <div className={`${h.wrap} ${o.ownedGrid}`}>
        <h2 id="owned-heading">{site["domain.own.heading"]}</h2>
        <ul className={o.ownedList}>
          {list(site["domain.own.items"]).map((line) => <li key={line}>{line}.</li>)}
        </ul>
      </div>
    </section>
  );
}

function Build() {
  const { site } = useSiteCopy();
  return (
    <section className={h.close} aria-labelledby="build-heading">
      <div className={h.wrap}>
        <h2 id="build-heading">{site["domain.build.heading"]}</h2>
        <p className={h.lead}>{site["domain.build.text"]}</p>
        <div className={`${h.ctaRow} ${h.closeCta}`}>
          <a className={`${h.btn} ${h.btnPlum}`} href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(site["domain.build.subject"])}`}>
            <Icon name="mail" className={h.ic} /> {site["domain.build.contact"]}
          </a>
          <p className={h.muted}>{CONTACT_EMAIL}</p>
        </div>
      </div>
    </section>
  );
}

const QUESTIONS = ["ssl", "builders", "site", "apex"] as const;

function Questions() {
  const { site } = useSiteCopy();
  return (
    <section className={h.faq} aria-labelledby="faq-heading">
      <div className={`${h.wrap} ${h.faqGrid}`}>
        <header className={h.secHead}><h2 id="faq-heading">{site["domain.faq.heading"]}</h2></header>
        <div className={h.faqList}>
          {QUESTIONS.map((q) => (
            <details key={q}>
              <summary>{site[`domain.faq.${q}`]}</summary>
              <p>{site[`domain.faq.${q}.answer`]}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/** /own-domain and /sv/own-domain: how a salon's booking lives on its own address or its own website. */
export function OwnDomainPage({ links, origin, bookingOrigin }: OwnDomainProps) {
  const { site, locale } = useSiteCopy();
  const { choice, theme, toggle } = useHomeTheme();
  const query = `?lang=${locale}`;
  const demo = `${links.demo}${query}`;
  const booking = `${bookingOrigin}${bookingHome(DEMO_SLUG)}${query}`;
  return (
    <div className={h.root} data-theme={choice ?? undefined}>
      <SiteHead page="own-domain" title={site["domain.title"]} description={site["domain.description"]} productOrigin={origin} />
      <a className={h.skip} href="#main">{site["skip"]}</a>
      <Header theme={theme} onTheme={toggle} />
      <main id="main">
        <section className={o.hero} aria-labelledby="hero-heading">
          <div className={`${h.wrap} ${o.heroGrid}`}>
            <div className={o.heroCopy}>
              <h1 id="hero-heading">{site["domain.heading"]}</h1>
              <p className={h.lead}>{site["domain.lead"]}</p>
            </div>
            <Example booking={booking} />
          </div>
        </section>
        <Ways bookingOrigin={bookingOrigin} />
        <Owned />
        <Build />
        <Questions />
      </main>
      <HomeFooter demo={demo} booking={booking} />
    </div>
  );
}
