import { CalendarCheck, Check, FolderOpen, MessagesSquare, PanelsTopLeft, Star } from "lucide-react";
import { PROJECT_REPOSITORY } from "../brand";
import { site } from "./en";
import s from "./site.module.css";

export function GitHubStar({ count }: { count: number | null }) {
  return (
    <a className={s.starLink} href={PROJECT_REPOSITORY}>
      <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
        <path d="M12 .3a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.24c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.6-2.8 5.63-5.48 5.93.43.37.81 1.1.81 2.22v3.31c0 .32.22.7.83.58A12 12 0 0 0 12 .3Z" />
      </svg>
      {site["github.star"]}
      <span className={s.starCount}><Star size={15} aria-hidden />{count?.toLocaleString("en-US")}</span>
    </a>
  );
}

const values = [
  { key: "simple", Icon: CalendarCheck },
  { key: "all", Icon: PanelsTopLeft },
  { key: "yours", Icon: FolderOpen },
  { key: "assistant", Icon: MessagesSquare },
] as const;

export function ProductValues() {
  return (
    <ul className={s.values}>
      {values.map(({ key, Icon }) => (
        <li key={key}>
          <Icon size={23} strokeWidth={1.5} aria-hidden />
          <div>
            <h2>{site[`value.${key}.heading`]}</h2>
            <p>{site[`value.${key}.body`]}</p>
            {key === "assistant" && <small>{site["value.assistant.soon"]}</small>}
          </div>
        </li>
      ))}
    </ul>
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
          {(["fee", "data", "page", "host"] as const).map((key) => (
            <tr key={key}>
              <th scope="row">{site[`compare.${key}`]}</th>
              <td><span className={s.mobileColumn} aria-hidden>{site["compare.typical"]}</span>{site[`compare.${key}.typical`]}</td>
              <td><span className={s.mobileColumn} aria-hidden>{site["compare.product"]}</span>
                <span className={s.benefit}><Check size={16} aria-hidden />{site[`compare.${key}.product`]}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
