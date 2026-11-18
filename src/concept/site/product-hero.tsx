import Image from "next/image";
import { ArrowDown, ArrowRight } from "lucide-react";
import { Wordmark } from "../ui/wordmark";
import { site } from "./en";
import { GitHubStar } from "./product-sections";
import s from "./site.module.css";
import e from "./editorial.module.css";

export function ProductHeader({ home }: { home?: string }) {
  return (
    <header className={e.masthead}>
      <div className={e.brand}>
        {home ? <a href={home}><Wordmark className={s.wordmark} label={site["landing.home"]} /></a> :
          <><Wordmark className={s.wordmark} /><span>{site["soon.status"]}</span></>}
      </div>
      <nav aria-label={site["soon.nav"]}>
        <a className={e.mapNav} href="#channel-map">{site["map.nav"]}</a>
        <a href="#tour">{site["landing.tour"]}</a>
        <a href="#waitlist">{site["landing.waitlist"]} <ArrowDown size={15} aria-hidden /></a>
      </nav>
    </header>
  );
}

export function ProductHero({ demo, stars }: { demo: string; stars: number | null }) {
  return (
    <section className={e.hero} aria-labelledby="promise">
      <div className={e.copy}>
        <h1 id="promise">{site["promise.first"]} <em>{site["promise.second"]}</em></h1>
        <p>{site["product.lead"]}</p>
        <div className={s.routes}>
          <a className={s.primary} href={demo}>{site["soon.demo"]} <ArrowRight size={17} aria-hidden /></a>
          <GitHubStar count={stars} />
        </div>
      </div>
      <figure className={e.photo}>
        <div className={e.room}>
          <Image src="/demo/salon.webp" alt={site["hero.alt"]} fill preload
            sizes="(min-width: 1500px) 700px, (min-width: 760px) 49vw, 94vw" />
          <div className={e.slip}>
            <div className={e.slipHead}><span>{site["hero.calendar"]}</span><span>{site["hero.day"]}</span></div>
            <div className={e.visit}>
              <time>{site["hero.time"]}</time>
              <div><strong>{site["hero.client"]}</strong><small>{site["hero.service"]}</small></div>
            </div>
          </div>
        </div>
        <figcaption><strong>{site["mini.salon"]}</strong><span>{site["hero.caption"]}</span></figcaption>
      </figure>
    </section>
  );
}
