import Head from "next/head";
import Image from "next/image";
import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Wordmark } from "../ui/wordmark";
import { useSiteCopy } from "./copy";
import { GitHubStar } from "./product-sections";
import s from "./site.module.css";
import e from "./editorial.module.css";

export function ProductHeader({ demo }: { demo: string }) {
  const { site } = useSiteCopy();
  return (
    <header className={e.masthead}>
      <Wordmark className={s.wordmark} />
      <nav aria-label={site["soon.nav"]}>
        <a href="#tour">{site["landing.tour"]}</a>
        <a className={e.storyNav} href="#story">{site["founder.nav"]}</a>
        <a href={demo}>{site["soon.demo"]}<ArrowRight size={14} aria-hidden /></a>
      </nav>
    </header>
  );
}

const chairSet = "/site/salon-chair-small.webp 768w, /site/salon-chair.webp 1536w";
const sizes = "(min-width: 1600px) 1512px, 98vw";

export function ProductHero({ demo, stars }: { demo: string; stars: number | null }) {
  const { site } = useSiteCopy();
  const frames = [
    { name: "chair", alt: site["hero.alt"], caption: site["hero.chair"] },
    { name: "tools", alt: site["hero.tools.alt"], caption: site["hero.tools"] },
    { name: "phone", alt: site["hero.phone.alt"], caption: site["hero.phone"] },
  ] as const;
  const [current, setCurrent] = useState(0);
  const frame = frames[current];
  const cover = frames[0];
  return (
    <section className={e.hero} data-photo={frame.name} aria-labelledby="promise">
      <Head><link rel="preload" as="image" imageSrcSet={chairSet} imageSizes={sizes} fetchPriority="high" /></Head>
      <div className={e.heroArt}>
        {/* Native responsive candidates match the preload and use the compressed originals directly. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/site/salon-${cover.name}.webp`} srcSet={chairSet} sizes={sizes} fetchPriority="high" width="1536" height="1024" alt={cover.alt} aria-hidden={current !== 0} />
        {current !== 0 && <Image key={frame.name} className={e.swapPhoto} src={`/site/salon-${frame.name}.webp`} alt={frame.alt} fill unoptimized />}
      </div>
      <div className={e.copy}>
        <h1 id="promise">{site["promise.first"]} <em>{site["promise.second"]}</em></h1>
        <p>{site["product.lead"]}</p>
        <div className={s.routes}>
          <a className={s.primary} href={demo}>{site["soon.demo"]} <ArrowRight size={16} aria-hidden /></a>
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
