import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "../ui/button";
import { Select } from "../ui/controls";
import { useSiteCopy } from "./copy";
import { MiniBooking } from "./mini-booking";
import { TourClip } from "./tour-clip";
import f from "./film.module.css";
import l from "./landing.module.css";

const films = [
  { key: "tour-16x9", label: "tour.overview", alt: "soon.tour.description" },
  { key: "booking", label: "tour.booking", alt: "landing.book.alt" },
  { key: "day", label: "tour.day", alt: "landing.day.alt" },
  { key: "treatments", label: "tour.treatments", alt: "landing.prices.alt" },
  { key: "campaign", label: "tour.campaign", alt: "landing.back.alt" },
  { key: "journal", label: "tour.journal", alt: "landing.card.alt" },
] as const;

/** Short films of the studio, or a sample booking on the salon's page. */
export function FilmTour() {
  const { site, locale } = useSiteCopy();
  const [index, setIndex] = useState(0);
  const [booking, setBooking] = useState(false);
  const film = films[index];
  return (
    <section id="tour" className={`${l.section} ${l.cream}`} aria-labelledby="tour-heading">
      <div className={`${l.wrap} ${f.film}`}>
        <div>
          <h2 className={l.title} id="tour-heading">{site["film.heading"]}</h2>
          <div className={f.modes}>
            <Button variant="secondary" size="sm" aria-pressed={!booking} onClick={() => setBooking(false)}>{site["tour.watch"]}</Button>
            <Button variant="secondary" size="sm" aria-pressed={booking} onClick={() => setBooking(true)}>{site["mini.pickTreatment"]}</Button>
          </div>
          {!booking && <Select className={f.select} aria-label={site["tour.choose"]} value={index} onChange={event => setIndex(Number(event.target.value))}>
            {films.map(({ key, label }, i) => <option value={i} key={key}>{site[label]}</option>)}
          </Select>}
        </div>
        <div className={f.screening}>
          {booking ? <>
            <MiniBooking />
            <Link prefetch={false} className={f.bookLink} href={locale === "sv" ? "/boka/salong-eko?lang=sv" : "/boka/salong-eko"}>{site["landing.book.link"]}<ArrowUpRight size={16} aria-hidden /></Link>
          </> : <TourClip key={film.key} name={film.key} title={site[film.label]} description={site[film.alt]} />}
        </div>
      </div>
    </section>
  );
}
