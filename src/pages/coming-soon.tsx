import Head from "next/head";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarCheck, PanelsTopLeft, FolderOpen, GitFork, Star } from "lucide-react";
import { PROJECT_REPOSITORY } from "@/concept/brand";
import { getSiteProps, type SiteProps } from "@/concept/site/links";
import { site } from "@/concept/site/en";
import { SiteHead } from "@/concept/site/site-head";
import s from "@/concept/site/site.module.css";
import { TOUR_POSTER, TourClip } from "@/concept/site/tour-clip";
import { WaitlistForm } from "@/concept/site/waitlist-form";
import { Wordmark } from "@/concept/ui/wordmark";

export const getServerSideProps = getSiteProps;

const values = [
  { key: "book", Icon: CalendarCheck },
  { key: "day", Icon: PanelsTopLeft },
  { key: "data", Icon: FolderOpen },
] as const;

export default function ComingSoon({ links, waitlist }: SiteProps) {
  return (
    <div className={`${s.page} ${s.soonPage}`}>
      <SiteHead title={site["soon.title"]} description={site["soon.description"]} />
      <Head><link rel="preload" as="image" href={TOUR_POSTER} fetchPriority="high" /></Head>
      <header className={`${s.masthead} ${s.demoHeader}`}>
        <Wordmark className={s.wordmark} />
        <nav aria-label={site["soon.nav"]}>
          <a href={links.demo}>{site["soon.nav.demo"]}</a>
          <a href={PROJECT_REPOSITORY}>{site["soon.github"]} <ArrowUpRight size={14} aria-hidden /></a>
        </nav>
      </header>
      <main>
        <section className={s.soonHero} aria-labelledby="promise">
          <div>
            <p className={s.soonStatus}>{site["soon.status"]}</p>
            <h1 id="promise" className={s.promise}>
              <span>{site["promise.first"]}</span>{" "}
              <span>{site["promise.second"]}</span>
            </h1>
            <p className={s.intro}>{site["soon.body"]}</p>
            <div className={s.routes}>
              <a className={s.primary} href={links.demo}>{site["soon.demo"]} <ArrowRight size={17} aria-hidden /></a>
              <a className={s.textLink} href={PROJECT_REPOSITORY}>{site["soon.repo"]} <ArrowUpRight size={15} aria-hidden /></a>
            </div>
          </div>
          <TourClip name="tour-16x9" title={site["soon.tour"]} description={site["soon.tour.description"]} />
        </section>
        <ul className={s.soonValues}>
          {values.map(({ key, Icon }) => (
            <li key={key}>
              <Icon size={25} strokeWidth={1.5} aria-hidden />
              <div>
                <h2>{site[`soon.${key}.heading`]}</h2>
                <p>{site[`soon.${key}.body`]}</p>
              </div>
            </li>
          ))}
        </ul>
        <section className={s.soonSource}>
          <div className={s.sourceTitle}>
            <GitFork className={s.fork} strokeWidth={1.5} aria-hidden />
            <h2>{site["soon.open.heading"]}</h2>
            <span>{site["soon.open.license"]}</span>
          </div>
          <p>{site["soon.open.body"]}</p>
          <a className={s.textLink} href={PROJECT_REPOSITORY}><Star size={17} aria-hidden /> {site["soon.open.star"]}</a>
        </section>
        <WaitlistForm from="/coming-soon" initial={waitlist ?? undefined} className={s.soonWaitlist} />
      </main>
      <footer className={`${s.footer} ${s.landingFooter} ${s.soonFooter}`}>
        <span>{site["soon.footer"]}</span>
        <Link prefetch={false} href="/privacy">{site["waitlist.privacy"]}</Link>
        <a href={PROJECT_REPOSITORY}>{site["soon.github"]}</a>
      </footer>
    </div>
  );
}
