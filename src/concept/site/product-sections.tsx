import { ArrowUpRight, Star, Terminal } from "lucide-react";
import { PROJECT_REPOSITORY } from "../brand";
import { site } from "./en";
import e from "./editorial.module.css";
import s from "./site.module.css";

export function GitHubStar({ count }: { count: number | null }) {
  return (
    <a className={s.starLink} href={PROJECT_REPOSITORY}>
      <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
        <path d="M12 .3a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.24c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.6-2.8 5.63-5.48 5.93.43.37.81 1.1.81 2.22v3.31c0 .32.22.7.83.58A12 12 0 0 0 12 .3Z" />
      </svg>
      {site["github.star"]}
      {count !== null && count > 0 && <span className={s.starCount}><Star size={15} aria-hidden />{count.toLocaleString("en-US")}</span>}
    </a>
  );
}

export function OpenSource() {
  const directory = new URL(PROJECT_REPOSITORY).pathname.split("/").pop();
  return (
    <section className={e.spread}>
      <div>
        <h2>{site["source.heading"]}</h2>
        <figure className={e.terminal}>
          <figcaption><span><Terminal size={16} aria-hidden /> {site["source.terminal"]}</span><small>{site["source.node"]}</small></figcaption>
          <pre><code>{`git clone ${PROJECT_REPOSITORY}.git ${directory}\ncd ${directory}\nnpm run demo`}</code></pre>
        </figure>
      </div>
      <dl className={e.ownership}>
        {(["code", "run", "data", "price"] as const).map(key => (
          <div key={key}><dt>{site[`source.${key}.title`]}</dt>
            <dd>{key === "code" ? <a href={PROJECT_REPOSITORY}>{site["source.code.body"]} <ArrowUpRight size={15} aria-hidden /></a> : site[`source.${key}.body`]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function OptionalAssistant() {
  return (
    <section className={e.spread}>
      <h2>{site["ai.heading"]}</h2>
      <div className={e.essay}>
        <p>{site["ai.body"]}</p>
        <small>{site["ai.availability"]}</small>
        <a className={s.textLink} href={`${PROJECT_REPOSITORY}/blob/main/docs/CONNECT_AI_ASSISTANT.md`}>{site["ai.link"]} <ArrowUpRight size={16} aria-hidden /></a>
      </div>
    </section>
  );
}

export function PlatformComparison() {
  return (
    <section className={s.platforms} aria-labelledby="platforms-heading">
      <h2 id="platforms-heading">{site["compare.heading"]}</h2>
      <table aria-labelledby="platforms-heading">
        <thead><tr>
          <td />
          <th scope="col">{site["compare.typical"]}</th>
          <th scope="col">{site["compare.product"]}</th>
        </tr></thead>
        <tbody>
          {(["fee", "card", "data", "page", "host", "assistant", "agents"] as const).map((key) => (
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
  const links = [
    ["star", PROJECT_REPOSITORY],
    ["talk", `${PROJECT_REPOSITORY}/discussions`],
    ["demo", demo],
    ["code", `${PROJECT_REPOSITORY}/issues?q=is%3Aopen+label%3A%22good+first+issue%22`],
  ] as const;
  return (
    <section id="join" className={e.spread} aria-labelledby="join-heading">
      <h2 id="join-heading">{site["movement.heading"]}</h2>
      <div className={e.essay}>
        <p>{site["movement.body"]}</p>
        <dl className={e.ownership}>
          {links.map(([key, href]) => (
            <div key={key}><dt><a href={href}>{site[`movement.${key}`]} <ArrowUpRight size={15} aria-hidden /></a></dt><dd>{site[`movement.${key}.body`]}</dd></div>
          ))}
        </dl>
      </div>
    </section>
  );
}
