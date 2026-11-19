import Image from "next/image";
import { ArrowUpRight, Star } from "lucide-react";
import { PROJECT_REPOSITORY } from "../brand";
import { useSiteCopy } from "./copy";
import e from "./editorial.module.css";
import s from "./site.module.css";

export function GitHubStar({ count }: { count: number | null }) {
  const { site, locale } = useSiteCopy();
  return (
    <a className={s.starLink} href={PROJECT_REPOSITORY}>
      <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
        <path d="M12 .3a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.24c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.6-2.8 5.63-5.48 5.93.43.37.81 1.1.81 2.22v3.31c0 .32.22.7.83.58A12 12 0 0 0 12 .3Z" />
      </svg>
      {site["github.star"]}
      {count !== null && count > 0 && <span className={s.starCount}><Star size={15} aria-hidden />{count.toLocaleString(locale)}</span>}
    </a>
  );
}

export function FounderStory() {
  const { site } = useSiteCopy();
  return (
    <section id="story" className={e.story} data-reveal>
      <Image className={e.door} src="/site/salon-door.webp" width={680} height={1020} unoptimized alt={site["founder.alt"]} />
      <div>
        <h2 className={e.display}>{site["founder.first"]} <em>{site["founder.second"]}</em></h2>
        <p>{site["founder.body"]}</p>
        <p>{site["founder.goal"]}</p>
      </div>
    </section>
  );
}

export function PlatformComparison() {
  const { site } = useSiteCopy();
  return (
    <section data-reveal className={s.platforms} aria-labelledby="platforms-heading">
      <h2 id="platforms-heading">{site["compare.heading"]}</h2>
      <table aria-labelledby="platforms-heading">
        <thead><tr>
          <td />
          <th scope="col">{site["compare.typical"]}</th>
          <th scope="col">{site["compare.product"]}</th>
        </tr></thead>
        <tbody>
          {(["fee", "card", "data", "page", "host"] as const).map((key) => (
            <tr key={key}>
              <th scope="row">{site[`compare.${key}`]}</th>
              <td>{site[`compare.${key}.typical`]}</td>
              <td>{site[`compare.${key}.product`]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function JoinMovement({ demo }: { demo: string }) {
  const { site } = useSiteCopy();
  return (
    <section id="join" className={e.movement} data-reveal>
      <div>
        <h2 className={e.display}>{site["movement.heading"]}</h2>
        <p>{site["movement.body"]}</p>
        <a href={demo}>{site["soon.demo"]} <ArrowUpRight size={16} aria-hidden /></a>
        <a href={`${PROJECT_REPOSITORY}/discussions`}>{site["movement.talk"]} <ArrowUpRight size={16} aria-hidden /></a>
        <a href={`${PROJECT_REPOSITORY}/issues?q=is%3Aopen+label%3A%22good+first+issue%22`}>{site["movement.code"]} <ArrowUpRight size={16} aria-hidden /></a>
      </div>
      <Image src="/site/salon-tools.webp" alt={site["hero.tools.alt"]} width={720} height={480} unoptimized />
    </section>
  );
}
