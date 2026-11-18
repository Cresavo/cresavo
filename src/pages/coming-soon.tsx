import Link from "next/link";
import { PROJECT_REPOSITORY } from "@/concept/brand";
import { getProductSiteProps, type ProductSiteProps } from "@/concept/site/links";
import { site } from "@/concept/site/en";
import { JoinMovement, OpenSource, OptionalAssistant, PlatformComparison } from "@/concept/site/product-sections";
import { SiteHead } from "@/concept/site/site-head";
import s from "@/concept/site/site.module.css";
import { TourClip } from "@/concept/site/tour-clip";
import { WaitlistForm } from "@/concept/site/waitlist-form";
import { ProductHeader, ProductHero } from "@/concept/site/product-hero";
import { ChannelMap } from "@/concept/site/channel-map";
import e from "@/concept/site/editorial.module.css";

export const getServerSideProps = getProductSiteProps;

export default function ComingSoon({ links, waitlist, stars }: ProductSiteProps) {
  return (
    <div className={`${s.page} ${e.canvas}`}>
      <SiteHead title={site["soon.title"]} description={site["soon.description"]} />
      <ProductHeader />
      <main className={s.landing}>
        <ProductHero demo={links.demo} stars={stars} />
        <ChannelMap />
        <section id="tour" className={e.spread}>
          <div className={e.filmIntro}><h2>{site["film.heading"]}</h2><p>{site["film.body"]}</p></div>
          <TourClip name="tour-16x9" title={site["soon.tour"]} description={site["soon.tour.description"]} />
        </section>
        <OpenSource />
        <OptionalAssistant />
        <PlatformComparison />
        <JoinMovement demo={links.demo} />
        <WaitlistForm from="/coming-soon" initial={waitlist ?? undefined} className={s.block} />
      </main>
      <footer className={`${s.footer} ${s.landingFooter} ${s.soonFooter}`}>
        <span>{site["soon.footer"]}</span>
        <Link prefetch={false} href="/privacy">{site["waitlist.privacy"]}</Link>
        <a href={PROJECT_REPOSITORY}>{site["soon.github"]}</a>
      </footer>
    </div>
  );
}
