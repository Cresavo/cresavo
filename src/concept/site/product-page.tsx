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

function FilmTour() {
  const [index, setIndex] = useState(0);
  const [booking, setBooking] = useState(false);
  const film = films[index];
  return (
    <section id="tour" className={e.film} data-reveal>
      <div>
        <h2 className={e.display}>{site["film.heading"]}</h2>
        <div className={e.filmModes}>
          <button aria-pressed={!booking} onClick={() => setBooking(false)}>{site["tour.watch"]}</button>
          <button aria-pressed={booking} onClick={() => setBooking(true)}>{site["mini.pickTreatment"]}</button>
        </div>
        {!booking && <select className={e.filmSelect} aria-label={site["tour.choose"]} value={index} onChange={event => setIndex(Number(event.target.value))}>
          {films.map(({ key, label }, i) => <option value={i} key={key}>{site[label]}</option>)}
        </select>}
      </div>
      <div className={e.screening}>
        {booking ? <>
          <MiniBooking />
          <Link prefetch={false} className={s.textLink} href="/boka/salong-eko">{site["landing.book.link"]}<ArrowUpRight size={16} aria-hidden /></Link>
        </> : <TourClip key={film.key} name={film.key} title={site[film.label]} description={site[film.alt]} />}
      </div>
    </section>
  );
}

export function ProductPage({ links, waitlist, stars, origin }: ProductSiteProps) {
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
      <SiteHead title={site["soon.title"]} description={site["soon.description"]} productOrigin={origin} />
      <ProductHeader demo={links.demo} />
      <main ref={main} className={s.landing}>
        <ProductHero demo={links.demo} stars={stars} />
        <StudioPreview />
        <FounderStory />
        <ChannelMap />
        <OpenDesign />
        <FilmTour />
        <PlatformComparison />
        <JoinMovement demo={links.demo} />
        <WaitlistForm from="/" initial={waitlist ?? undefined} className={s.block} />
      </main>
      <footer className={`${s.footer} ${s.landingFooter} ${s.soonFooter}`}>
        <span>{site["soon.footer"]}</span>
        <Link prefetch={false} href="/privacy">{site["waitlist.privacy"]}</Link>
        <a href={PROJECT_REPOSITORY}>{site["soon.github"]}</a>
      </footer>
    </div>
  );
}
