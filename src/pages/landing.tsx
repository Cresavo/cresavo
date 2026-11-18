import Link from "next/link";
import { getSiteProps, type SiteProps } from "@/concept/site/links";
import { site } from "@/concept/site/en";
import { SiteHead } from "@/concept/site/site-head";
import { WaitlistForm } from "@/concept/site/waitlist-form";
import s from "@/concept/site/site.module.css";
import { Wordmark } from "@/concept/ui/wordmark";

export const getServerSideProps = getSiteProps;

// Cropped captures of the delivered build (docs/design/CRESAVO.md says how to refresh them); sizes are the files' own.
const TODAY = { narrow: { width: 780, height: 904 }, wide: { width: 1120, height: 904 } };
const BOOKING = { width: 716, height: 910 };

// The demo landing: what the product does for a salon or clinic, and a clear way into the demo. Plain links; only the waiting list form uses script, and it works without.
const FEATURES = ["book", "day", "back", "card"] as const;
const STEPS = [["1", "/studio"], ["2", "/studio/calendar"], ["3", "/boka/salong-eko"]] as const;

export default function Landing({ links, waitlist }: SiteProps) {
  return (
    <div className={s.page}>
      <SiteHead title={site["landing.title"]} description={site["landing.description"]} />
      <header className={s.masthead}>
        <a className={s.home} href={links.apex}>
          <Wordmark className={s.wordmark} label={site["landing.home"]} />
        </a>
      </header>
      <main className={s.landing}>
        <div className={s.hero}>
          <div>
            <h1 className={s.promise}>
              <span>{site["promise.first"]}</span>
              <span>{site["promise.second"]}</span>
            </h1>
            <p className={s.intro}>{site["landing.intro"]}</p>
            <div className={s.routes}>
              <Link className={s.primary} href="/studio">{site["landing.studio"]}</Link>
              <Link className={s.secondary} href="/boka/salong-eko">{site["landing.booking"]}</Link>
            </div>
            <p className={s.note}>{site["landing.note"]}</p>
          </div>
          <picture className={s.figure}>
            <source media="(min-width: 1024px) and (prefers-color-scheme: dark)" srcSet="/site/today-wide-dark.png" {...TODAY.wide} />
            <source media="(min-width: 1024px)" srcSet="/site/today-wide-light.png" {...TODAY.wide} />
            <source media="(prefers-color-scheme: dark)" srcSet="/site/today-narrow-dark.png" {...TODAY.narrow} />
            <img src="/site/today-narrow-light.png" alt={site["landing.today.alt"]} {...TODAY.narrow} />
          </picture>
        </div>

        {FEATURES.map((feature) => (
          <section key={feature} className={s.block}>
            <h2>{site[`landing.${feature}.heading`]}</h2>
            <div>
              <p>{site[`landing.${feature}.body`]}</p>
              {/* A fixed crop of the tenant's own page; the hero uses <picture> for the same reason. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {feature === "book" && <img className={`${s.figure} ${s.bookingFigure}`} src="/site/booking.png" alt={site["landing.book.alt"]} {...BOOKING} loading="lazy" />}
            </div>
          </section>
        ))}

        <section className={s.block}>
          <h2>{site["landing.try.heading"]}</h2>
          <ol className={s.steps}>
            {STEPS.map(([step, href]) => (
              <li key={step}>
                <h3>{site[`landing.try.${step}.title`]}</h3>
                <p>{site[`landing.try.${step}.body`]}</p>
                <Link href={href}>{site[`landing.try.${step}.link`]}</Link>
              </li>
            ))}
          </ol>
        </section>

        <section className={s.block}>
          <h2>{site["landing.start.heading"]}</h2>
          <div>
            <ul className={s.start}>
              <li>
                <Link href="/studio?start=essentials">{site["landing.start.simple"]}</Link>
                <span>{site["landing.start.simple.note"]}</span>
              </li>
              <li>
                <Link href="/studio?start=everything">{site["landing.start.everything"]}</Link>
                <span>{site["landing.start.everything.note"]}</span>
              </li>
            </ul>
            <p className={s.note}>{site["landing.start.switch"]}</p>
          </div>
        </section>

        <section className={s.block}>
          <h2>{site["landing.open.heading"]}</h2>
          <p>{site["landing.open.body"]}</p>
        </section>

        <WaitlistForm from="/landing" initial={waitlist ?? undefined} className={s.block} />
      </main>
      <footer className={`${s.footer} ${s.landingFooter}`}>
        <a href={links.apex}>{site["landing.about"]}</a>
        <span>{site["landing.footer"]}</span>
      </footer>
    </div>
  );
}
