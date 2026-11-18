import Head from "next/head";
import Link from "next/link";
import { ArrowRight, GitFork, Star } from "lucide-react";
import { PROJECT_REPOSITORY } from "@/concept/brand";
import { getProductSiteProps, type ProductSiteProps } from "@/concept/site/links";
import { site } from "@/concept/site/en";
import { GitHubStar, PlatformComparison, ProductValues } from "@/concept/site/product-sections";
import { SiteHead } from "@/concept/site/site-head";
import s from "@/concept/site/site.module.css";
import { TOUR_POSTER, TourClip } from "@/concept/site/tour-clip";
import { WaitlistForm } from "@/concept/site/waitlist-form";
import { Wordmark } from "@/concept/ui/wordmark";

export const getServerSideProps = getProductSiteProps;

export default function ComingSoon({ links, waitlist, stars }: ProductSiteProps) {
  return (
    <div className={`${s.page} ${s.soonPage}`}>
      <SiteHead title={site["soon.title"]} description={site["soon.description"]} />
      <Head><link rel="preload" as="image" href={TOUR_POSTER} fetchPriority="high" /></Head>
      <header className={`${s.masthead} ${s.demoHeader}`}>
        <Wordmark className={s.wordmark} />
        <nav aria-label={site["soon.nav"]}>
          <a href={links.demo}>{site["soon.nav.demo"]}</a>
          <GitHubStar count={stars} />
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
            <p className={s.intro}>{site["product.lead"]}</p>
            <div className={s.routes}>
              <a className={s.primary} href={links.demo}>{site["soon.demo"]} <ArrowRight size={17} aria-hidden /></a>
              <GitHubStar count={stars} />
            </div>
          </div>
          <TourClip name="tour-16x9" title={site["soon.tour"]} description={site["soon.tour.description"]} />
        </section>
        <ProductValues />
        <PlatformComparison />
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
