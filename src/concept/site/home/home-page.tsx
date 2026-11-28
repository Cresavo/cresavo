import { Wordmark } from "../../ui/wordmark";
import { useSiteCopy } from "../copy";
import { sitePath } from "../language";
import type { ProductSiteProps } from "../links";
import { SiteHead } from "../site-head";
import { WaitlistForm } from "../waitlist-form";
import { DotField } from "./dot-field";
import { wordmarkShape } from "./dot-shapes";
import { HomeHeader } from "./home-header";
import { Closing, Founder, HomeFooter, Manifesto, NextStep, OpenSource, Pricing, Questions, Status } from "./home-sections";
import { HeroFlow } from "./hero-flow";
import { Icon } from "./icons";
import { ProductShot, type Shot } from "./product-shot";
import { Receptionist } from "./receptionist";
import { useHomeTheme } from "./use-home-theme";
import h from "./home.module.css";
import l from "../landing.module.css";

/** Salong Eko's client booking page, on the same host as the studio. */
const BOOKING_PATH = "/boka/salong-eko";

/** Screenshots of the live demo (public/site/landing), desktop from 600 px and the phone shot below it. */
const SHOTS = {
  today: { wide: { file: "today-1280", width: 1280, height: 900 }, narrow: { file: "today-390", width: 780, height: 1240 }, themed: true },
  book: { wide: { file: "booking-1280", width: 1024, height: 900 }, narrow: { file: "booking-390", width: 780, height: 1080 }, themed: false },
  calendar: { wide: { file: "calendar-1280", width: 1280, height: 900 }, narrow: { file: "calendar-390", width: 780, height: 1300 }, themed: true },
  card: { wide: { file: "journal-1280", width: 1280, height: 900 }, narrow: { file: "customer-390", width: 780, height: 1310 }, themed: true },
  call: { wide: { file: "call-1280", width: 576, height: 708 }, narrow: { file: "call-390", width: 780, height: 960 }, themed: true },
} satisfies Record<string, Shot>;

function Hero({ demo, booking, tint }: { demo: string; booking: string; tint: string }) {
  const { site } = useSiteCopy();
  return (
    <section className={h.hero} id="top" aria-labelledby="hero-heading">
      <DotField className={h.dotStage} shape={wordmarkShape} label={site["home.hero.mark"]} tint={tint}>
        <Wordmark className={h.fallback} label="" />
      </DotField>
      <div className={`${h.wrap} ${h.heroCopy}`}>
        <p className={h.kicker}>{site["home.hero.kicker"]}</p>
        <h1 id="hero-heading">{site["home.hero.heading"]}</h1>
        <p className={h.heroLine}>{site["home.hero.lead"]}</p>
        <div className={`${h.ctaRow} ${h.heroCta}`}>
          <a className={`${h.btn} ${h.btnPlum}`} href={demo}>{site["home.hero.demo"]} <Icon name="arrow" className={h.ic} /></a>
          <a className={h.textLink} href={booking}>{site["home.hero.booking"]}</a>
        </div>
      </div>
      <div className={h.wrap}><HeroFlow demo={demo} /></div>
    </section>
  );
}

type MomentKey = "book" | "today" | "card" | "call";

/** A moment's heading and line. Each moment places them differently around its screen. */
function MomentText({ id }: { id: MomentKey }) {
  const { site } = useSiteCopy();
  return (
    <div className={h.momentText}>
      <h3 id={`moment-${id}`}>{site[`home.${id}.heading`]}</h3>
      <p>{site[`home.${id}.text`]}</p>
    </div>
  );
}

/**
 * From booking to chair: four moments of the salon day, each with its own form so they never read as one
 * card repeated. The booking headline runs across the page over an offset booking page; the calendar gets
 * the full width (Today is already the hero's picture); the client card sits offset with its words under
 * it; the phone call is a short closing band.
 */
function Product() {
  const { site } = useSiteCopy();
  return (
    <section className={h.day} id="how" aria-labelledby="product-heading">
      <div className={h.wrap}>
        <h2 id="product-heading" className={h.dayHead}>{site["home.product.heading"]}</h2>
        <article className={`${h.moment} ${h.mBook}`} aria-labelledby="moment-book">
          <MomentText id="book" />
          <div className={h.mScreen}><ProductShot shot={SHOTS.book} label={site["home.book.label"]} /></div>
        </article>
        <article className={`${h.moment} ${h.mToday}`} aria-labelledby="moment-today">
          <MomentText id="today" />
          <div className={h.mScreen}><ProductShot shot={SHOTS.calendar} label={site["home.calendar.label"]} /></div>
        </article>
        <article className={`${h.moment} ${h.mCard}`} aria-labelledby="moment-card">
          <MomentText id="card" />
          <div className={h.mScreen}><ProductShot shot={SHOTS.card} label={site["home.card.label"]} /></div>
        </article>
      </div>
      <article className={`${h.moment} ${h.mCall}`} aria-labelledby="moment-call">
        <div className={`${h.wrap} ${h.mCallIn}`}>
          <MomentText id="call" />
          <div className={h.mScreen}><ProductShot shot={SHOTS.call} label={site["home.call.label"]} className={h.callShot} /></div>
        </div>
      </article>
    </section>
  );
}

/** The product homepage, in English at / and in Swedish at /sv. */
export function HomePage({ links, waitlist, waitlistOpen, origin }: ProductSiteProps) {
  const { site, locale } = useSiteCopy();
  const { choice, theme, toggle } = useHomeTheme();
  // The dots re-read their colours whenever the page's colour source changes. The theme alone is not enough:
  // a saved "light" on a dark system leaves it at "light" while data-theme lands a render after the field is built.
  const tint = `${choice ?? "system"}:${theme}`;
  // The demo opens in the language of the page the visitor came from, whatever an earlier visit saved.
  const query = `?lang=${locale}`;
  const demo = `${links.demo}${query}`;
  const booking = `${links.demo.replace(/\/studio$/, BOOKING_PATH)}${query}`;
  return (
    <div className={h.root} data-theme={choice ?? undefined}>
      <SiteHead title={site["soon.title"]} description={site["soon.description"]} productOrigin={origin} />
      <a className={h.skip} href="#main">{site["skip"]}</a>
      <HomeHeader demo={demo} theme={theme} onTheme={toggle} />
      <main id="main">
        <Hero demo={demo} booking={booking} tint={tint} />
        <div className={h.wrap}>
          <ProductShot shot={SHOTS.today} label={site["home.today.label"]} className={h.showcase} eager />
        </div>
        <Product />
        <Receptionist />
        <Manifesto />
        <OpenSource />
        <NextStep />
        <Founder />
        <Status />
        <Pricing />
        <Questions />
        {waitlistOpen
          ? <div className={l.page}><WaitlistForm from={sitePath(locale)} initial={waitlist ?? undefined} demo={demo} /></div>
          : <Closing demo={demo} />}
      </main>
      <HomeFooter demo={demo} booking={booking} />
    </div>
  );
}
