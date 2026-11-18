import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PROJECT_REPOSITORY } from "../brand";
import { ChannelMap } from "./channel-map";
import { site } from "./en";
import type { ProductSiteProps } from "./links";
import { MiniBooking } from "./mini-booking";
import { OpenDesign } from "./open-design";
import { ProductHeader, ProductHero } from "./product-hero";
import { FounderStory, JoinMovement, PlatformComparison } from "./product-sections";
import { SiteHead } from "./site-head";
import { StudioPreview } from "./studio-preview";
import { TourClip } from "./tour-clip";
import { WaitlistForm } from "./waitlist-form";
import s from "./site.module.css";
import e from "./editorial.module.css";

const films = [
  { key: "tour-16x9", label: "tour.overview", alt: "soon.tour.description" },
  { key: "booking", label: "tour.booking", alt: "landing.book.alt" },
  { key: "day", label: "tour.day", alt: "landing.day.alt" },
  { key: "treatments", label: "tour.treatments", alt: "landing.prices.alt" },
  { key: "campaign", label: "tour.campaign", alt: "landing.back.alt" },
  { key: "journal", label: "tour.journal", alt: "landing.card.alt" },
] as const;

function FilmTour({ studio }: { studio: boolean }) {
  const [index, setIndex] = useState(0);
  const film = films[index];
  return (
    <section id="tour" className={e.film} data-reveal>
      <div>
        <h2 className={e.display}>{site["film.heading"]}</h2>
        {studio && <select className={e.filmSelect} aria-label={site["tour.choose"]} value={index} onChange={event => setIndex(Number(event.target.value))}>
          {films.map(({ key, label }, i) => <option value={i} key={key}>{site[label]}</option>)}
        </select>}
      </div>
      <div className={e.screening}><TourClip key={film.key} name={film.key} title={site[film.label]} description={site[film.alt]} /></div>
    </section>
  );
}

export function ProductPage({ links, waitlist, stars, studio }: ProductSiteProps & { studio: boolean }) {
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!main.current || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.setAttribute("data-entered", "");
        observer.unobserve(entry.target);
      }
    });
    main.current.querySelectorAll("[data-reveal]").forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return (
    <div className={`${s.page} ${e.canvas}`}>
      <SiteHead title={site[studio ? "landing.title" : "soon.title"]} description={site[studio ? "landing.description" : "soon.description"]} />
      <ProductHeader home={studio ? links.apex : undefined} />
      <main ref={main} className={s.landing}>
        <ProductHero demo={studio ? "/studio" : links.demo} stars={stars} studio={studio} />
        <StudioPreview />
        <FounderStory />
        <ChannelMap />
        <OpenDesign />
        <FilmTour studio={studio} />
        {studio && <div className={e.bookingSample}>
          <div><h2 className={e.display}>{site["landing.book.heading"]}</h2>
          <Link prefetch={false} className={s.textLink} href="/boka/salong-eko">{site["landing.book.link"]}<ArrowUpRight size={16} aria-hidden /></Link></div>
          <MiniBooking />
        </div>}
        <PlatformComparison />
        <JoinMovement />
        <WaitlistForm from={studio ? "/landing" : "/coming-soon"} initial={waitlist ?? undefined} className={s.block} />
      </main>
      <footer className={`${s.footer} ${s.landingFooter} ${s.soonFooter}`}>
        <span>{site[studio ? "landing.footer" : "soon.footer"]}</span>
        {studio && <a href={links.apex}>{site["landing.about"]}</a>}
        <Link prefetch={false} href="/privacy">{site["waitlist.privacy"]}</Link>
        <a href={PROJECT_REPOSITORY}>{site["soon.github"]}</a>
      </footer>
    </div>
  );
}
