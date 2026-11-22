import { useRef } from "react";
import { Wordmark } from "../../ui/wordmark";
import { useSiteCopy } from "../copy";
import { sitePath } from "../language";
import type { ProductSiteProps } from "../links";
import { SiteHead } from "../site-head";
import { WaitlistForm } from "../waitlist-form";
import { DotField } from "./dot-field";
import { iconShape, wordmarkShape } from "./dot-shapes";
import { HomeHeader } from "./home-header";
import { Closing, Founder, HomeFooter, Manifesto, NextStep, OpenSource, Pricing, Questions, Status } from "./home-sections";
import { Icon } from "./icons";
import { BookingPanel, CallPanel, ClientPanel, TodayPanel } from "./panels";
import { useHomeTheme } from "./use-home-theme";
import { useReveal } from "./use-reveal";
import h from "./home.module.css";
import l from "../landing.module.css";

/** Salong Eko's client booking page, on the same host as the studio. */
const BOOKING_PATH = "/boka/salong-eko";

function Hero({ demo, booking, theme }: { demo: string; booking: string; theme: string }) {
  const { site } = useSiteCopy();
  return (
    <section className={h.hero} id="top" aria-labelledby="hero-heading">
      <DotField className={h.dotStage} shape={wordmarkShape} label={site["home.hero.mark"]} theme={theme}>
        <Wordmark className={h.fallback} label="" />
      </DotField>
      <div className={`${h.wrap} ${h.heroCopy}`}>
        <p className={h.kicker}>{site["home.hero.kicker"]}</p>
        <h1 id="hero-heading">{site["home.hero.heading"]}</h1>
        <p className={h.heroLine}>{site["home.hero.lead"]}</p>
        <div className={`${h.ctaRow} ${h.heroCta}`}>
          <a className={`${h.btn} ${h.btnPlum}`} href={demo}>{site["home.hero.demo"]} <Icon name="arrow" className={h.ic} /></a>
          <a className={`${h.btn} ${h.btnLine}`} href={booking}>{site["home.hero.booking"]}</a>
        </div>
      </div>
    </section>
  );
}

const MOMENTS = [
  { key: "book", icon: "list", num: "01", Panel: BookingPanel },
  { key: "today", icon: "cal", num: "02", Panel: TodayPanel },
  { key: "card", icon: "client", num: "03", Panel: ClientPanel },
  { key: "call", icon: "phone", num: null, Panel: CallPanel },
] as const;

/** From booking to chair: three moments of the salon day and one extra, each beside its screen. */
function Product({ theme }: { theme: string }) {
  const { site } = useSiteCopy();
  return (
    <section className={h.day} id="how" aria-labelledby="product-heading">
      <div className={h.wrap}>
        <header className={`${h.secHead} ${h.reveal}`} data-reveal="">
          <p className={h.eyebrow}>{site["home.nav.product"]}</p>
          <h2 id="product-heading">{site["home.product.heading"]}</h2>
        </header>
        {MOMENTS.map(({ key, icon, num, Panel }, i) => (
          <article key={key} className={`${h.moment} ${i % 2 ? h.flip : ""} ${num ? "" : h.extra}`} aria-labelledby={`moment-${key}`}>
            <div className={`${h.momentText} ${h.reveal}`} data-reveal="">
              <div className={h.mHead}>
                <DotField className={h.mIcon} shape={() => iconShape(icon)} theme={theme} />
                <p className={h.mNum}>{num ?? site["home.call.also"]}</p>
              </div>
              <h3 id={`moment-${key}`}>{site[`home.${key}.heading`]}</h3>
              <p>{site[`home.${key}.text`]}</p>
            </div>
            <Panel />
          </article>
        ))}
      </div>
    </section>
  );
}

/** The product homepage, in English at / and in Swedish at /sv. */
export function HomePage({ links, waitlist, waitlistOpen, origin }: ProductSiteProps) {
  const { site, locale } = useSiteCopy();
  const { choice, theme, toggle } = useHomeTheme();
  const root = useRef<HTMLDivElement>(null);
  useReveal(root);
  // The demo opens in the language of the page the visitor came from, whatever an earlier visit saved.
  const query = `?lang=${locale}`;
  const demo = `${links.demo}${query}`;
  const booking = `${links.demo.replace(/\/studio$/, BOOKING_PATH)}${query}`;
  return (
    <div ref={root} className={h.root} data-theme={choice ?? undefined}>
      <SiteHead title={site["soon.title"]} description={site["soon.description"]} productOrigin={origin} />
      <a className={h.skip} href="#main">{site["skip"]}</a>
      <HomeHeader demo={demo} theme={theme} onTheme={toggle} />
      <main id="main">
        <Hero demo={demo} booking={booking} theme={theme} />
        <Product theme={theme} />
        <Manifesto />
        <OpenSource theme={theme} />
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
