import Head from "next/head";
import Image from "next/image";
import { useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";
import { Wordmark } from "../ui/wordmark";
import { site } from "./en";
import { GitHubStar } from "./product-sections";
import s from "./site.module.css";
import e from "./editorial.module.css";

export function ProductHeader({ home }: { home?: string }) {
  return (
    <header className={e.masthead}>
      {home ? <a href={home}><Wordmark className={s.wordmark} label={site["landing.home"]} /></a>
        : <Wordmark className={s.wordmark} />}
      <nav aria-label={site["soon.nav"]}>
        <a href="#tour">{site["landing.tour"]}</a>
        <a className={e.storyNav} href="#story">{site["founder.nav"]}</a>
        <a href="#waitlist">{site["landing.waitlist"]}<ArrowDown size={14} aria-hidden /></a>
      </nav>
    </header>
  );
}

const frames = [
  { name: "chair", alt: site["hero.alt"], caption: site["hero.chair"] },
  { name: "tools", alt: site["hero.tools.alt"], caption: site["hero.tools"] },
  { name: "phone", alt: site["hero.phone.alt"], caption: site["hero.phone"] },
] as const;
const chairSet = "/site/salon-chair-small.webp 768w, /site/salon-chair.webp 1536w";
const phoneSet = "/site/salon-phone.webp 720w, /site/salon-phone-wide.webp 1280w";
const sizes = "(min-width: 1600px) 1512px, 98vw";

export function ProductHero({ demo, stars, studio }: { demo: string; stars: number | null; studio: boolean }) {
  const [current, setCurrent] = useState(0);
  const album = studio ? [frames[2], frames[0], frames[1]] : frames;
  const frame = album[current];
  const cover = album[0];
  const coverSet = studio ? phoneSet : chairSet;
  const coverSizes = studio ? "(min-width: 731px) 64vw, 98vw" : sizes;
  return (
    <section className={e.hero} data-photo={frame.name} aria-labelledby="promise">
      <Head><link rel="preload" as="image" imageSrcSet={coverSet} imageSizes={coverSizes} fetchPriority="high" /></Head>
      <div className={e.heroArt}>
        {/* Native responsive candidates match the preload and use the compressed originals directly. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/site/salon-${cover.name}.webp`} srcSet={coverSet} sizes={coverSizes} fetchPriority="high" width="1536" height="1024" alt={cover.alt} aria-hidden={current !== 0} />
        {current !== 0 && <Image key={frame.name} className={e.swapPhoto} src={`/site/salon-${frame.name}.webp`} alt={frame.alt} fill unoptimized />}
      </div>
      <div className={e.copy}>
        <h1 id="promise">{site[studio ? "hero.demo.first" : "promise.first"]} <em>{site[studio ? "hero.demo.second" : "promise.second"]}</em></h1>
        <p>{site[studio ? "hero.demo.lead" : "product.lead"]}</p>
        <div className={s.routes}>
          <a className={s.primary} href={demo}>{site[studio ? "hero.studio" : "soon.demo"]} <ArrowRight size={16} aria-hidden /></a>
          <GitHubStar count={stars} />
        </div>
      </div>
      <div className={e.gallery} role="group" aria-label={site["hero.gallery"]}>
        <span className={e.plateNumber} aria-hidden>{String(current + 1).padStart(2, "0")} / 03</span>
        <span aria-live="polite">{site["mini.salon"]} <i> / </i> {frame.caption}</span>
        <div>
          <button aria-label={site["hero.previous"]} onClick={() => setCurrent((current + frames.length - 1) % frames.length)}><ArrowLeft size={18} /></button>
          <button aria-label={site["hero.next"]} onClick={() => setCurrent((current + 1) % frames.length)}><ArrowRight size={18} /></button>
        </div>
      </div>
    </section>
  );
}
