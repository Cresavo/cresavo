import Link from "next/link";
import { MiniBooking } from "@/concept/site/mini-booking";
import { TourClip } from "@/concept/site/tour-clip";
import { ArrowDown, ArrowRight, BookOpen, CalendarDays, Globe, Megaphone, Tag } from "lucide-react";
import { getSiteProps, type SiteProps } from "@/concept/site/links";
import { site } from "@/concept/site/en";
import { SiteHead } from "@/concept/site/site-head";
import { WaitlistForm } from "@/concept/site/waitlist-form";
import s from "@/concept/site/site.module.css";
import { Wordmark } from "@/concept/ui/wordmark";

export const getServerSideProps = getSiteProps;

const FEATURES = [
  { key: "book", screen: "booking", icon: Globe, href: "/boka/salong-eko" },
  { key: "day", screen: "day", icon: CalendarDays, href: "/studio" },
  { key: "prices", screen: "treatments", icon: Tag, href: "/studio/more/services" },
  { key: "back", screen: "campaign", icon: Megaphone, href: "/studio/more/campaigns" },
  { key: "card", screen: "journal", icon: BookOpen, href: "/studio/customers" },
] as const;
const STEPS = [["1", "/studio"], ["2", "/studio/calendar"], ["3", "/boka/salong-eko"]] as const;

export default function Landing({ links, waitlist }: SiteProps) {
  return (
    <div className={`${s.page} ${s.demoPage}`}>
      <SiteHead title={site["landing.title"]} description={site["landing.description"]} />
      <header className={`${s.masthead} ${s.demoHeader}`}>
        <a className={s.home} href={links.apex}>
          <Wordmark className={s.wordmark} label={site["landing.home"]} />
        </a>
        <nav aria-label={site["landing.nav"]}>
          <a href="#tour">{site["landing.tour"]}</a>
          <a href="#waitlist">{site["landing.waitlist"]} <ArrowDown size={14} aria-hidden /></a>
        </nav>
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
              <Link prefetch={false} className={s.primary} href="/studio">{site["landing.studio"]} <ArrowRight size={18} aria-hidden /></Link>
              <Link prefetch={false} className={s.secondary} href="/boka/salong-eko">{site["landing.booking"]}</Link>
            </div>
            <p className={s.note}>{site["landing.note"]}</p>
          </div>
          <div className={s.devices}>
            <div className={s.laptop}>
              <picture className={s.screen}>
                <source media="(prefers-color-scheme: dark)" srcSet="/site/studio-dark.webp" />
                <img src="/site/studio-light.webp" alt={site["landing.studio.alt"]} width={1420} height={830} decoding="async" />
              </picture>
            </div>
            <div className={s.phone}><MiniBooking /></div>
          </div>
        </div>

        <div id="tour" className={s.tour}>
          {FEATURES.map(({ key, screen, icon: Icon, href }) => (
            <section key={key} className={s.feature}>
              <div className={s.featureText}>
                <h2>{site[`landing.${key}.heading`]}</h2>
                <p>{site[`landing.${key}.body`]}</p>
                <Link prefetch={false} href={href} className={s.textLink}><Icon size={17} strokeWidth={1.6} aria-hidden /> {site[`landing.${key}.link`]}</Link>
              </div>
              <div className={`${s.plate} ${s[screen]}`}>
                <TourClip name={screen} title={site[`landing.${key}.heading`]} description={site[`landing.${key}.alt`]} />
              </div>
            </section>
          ))}
        </div>

        <section className={s.walkthrough}>
          <h2>{site["landing.try.heading"]}</h2>
          <ol className={s.steps}>
            {STEPS.map(([step, href]) => (
              <li key={step}>
                <h3>{site[`landing.try.${step}.title`]}</h3>
                <p>{site[`landing.try.${step}.body`]}</p>
                <Link prefetch={false} href={href} className={s.textLink}>{site[`landing.try.${step}.link`]} <ArrowRight size={16} aria-hidden /></Link>
              </li>
            ))}
          </ol>
        </section>

        <section className={s.compare}>
          <h2>{site["landing.start.heading"]}</h2>
          <ul className={s.start}>
            {(["simple", "everything"] as const).map((mode) => (
              <li key={mode}>
                <Link prefetch={false} className={s.textLink} href={`/studio?start=${mode === "simple" ? "essentials" : mode}`}>
                  {site[`landing.start.${mode}`]} <ArrowRight size={18} aria-hidden />
                </Link>
                <p>{site[`landing.start.${mode}.note`]}</p>
              </li>
            ))}
          </ul>
          <p className={s.note}>{site["landing.start.switch"]}</p>
        </section>

        <section className={s.openSource}>
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
