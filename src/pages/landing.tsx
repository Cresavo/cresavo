import Link from "next/link";
import { MiniBooking } from "@/concept/site/mini-booking";
import { TourClip } from "@/concept/site/tour-clip";
import { ArrowRight, BookOpen, CalendarDays, Globe, Megaphone, Tag } from "lucide-react";
import { getProductSiteProps, type ProductSiteProps } from "@/concept/site/links";
import { site } from "@/concept/site/en";
import { JoinMovement, OpenSource, OptionalAssistant, PlatformComparison } from "@/concept/site/product-sections";
import { SiteHead } from "@/concept/site/site-head";
import { WaitlistForm } from "@/concept/site/waitlist-form";
import s from "@/concept/site/site.module.css";
import { ProductHeader, ProductHero } from "@/concept/site/product-hero";
import { ChannelMap } from "@/concept/site/channel-map";
import e from "@/concept/site/editorial.module.css";

export const getServerSideProps = getProductSiteProps;

const FEATURES = [
  { key: "book", screen: "booking", icon: Globe, href: "/boka/salong-eko" },
  { key: "day", screen: "day", icon: CalendarDays, href: "/studio" },
  { key: "prices", screen: "treatments", icon: Tag, href: "/studio/more/services" },
  { key: "back", screen: "campaign", icon: Megaphone, href: "/studio/more/campaigns" },
  { key: "card", screen: "journal", icon: BookOpen, href: "/studio/customers" },
] as const;
const STEPS = [["1", "/studio"], ["2", "/studio/calendar"], ["3", "/boka/salong-eko"]] as const;

export default function Landing({ links, waitlist, stars }: ProductSiteProps) {
  return (
    <div className={`${s.page} ${e.canvas}`}>
      <SiteHead title={site["landing.title"]} description={site["landing.description"]} />
      <ProductHeader home={links.apex} />
      <main className={s.landing}>
        <ProductHero demo="/studio" stars={stars} />
        <ChannelMap />
        <OpenSource />
        <OptionalAssistant />
        <div id="tour" className={s.tour}>
          {FEATURES.map(({ key, screen, icon: Icon, href }) => (
            <section key={key} className={s.feature}>
              <div className={s.featureText}>
                <h2>{site[`landing.${key}.heading`]}</h2>
                <p>{site[`landing.${key}.body`]}</p>
                <Link prefetch={false} href={href} className={s.textLink}><Icon size={17} strokeWidth={1.6} aria-hidden /> {site[`landing.${key}.link`]}</Link>
                {key === "book" && <div className={e.sample}><MiniBooking /></div>}
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

        <PlatformComparison />
        <JoinMovement demo={"/studio"} />
        <WaitlistForm from="/landing" initial={waitlist ?? undefined} className={s.block} />
      </main>
      <footer className={`${s.footer} ${s.landingFooter}`}>
        <a href={links.apex}>{site["landing.about"]}</a>
        <span>{site["landing.footer"]}</span>
      </footer>
    </div>
  );
}
