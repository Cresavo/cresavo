import { ArrowUpRight, Rss } from "lucide-react";
import { PROJECT_REPOSITORY } from "../brand";
import { useSiteCopy } from "./copy";
import type { ProjectActivity } from "./links";
import e from "./editorial.module.css";
import r from "./release-feed.module.css";

const zone = "Europe/Stockholm";
const day = 24 * 60 * 60 * 1000;

function calendarDay(iso: string) {
  return Date.parse(new Date(iso).toLocaleDateString("en-CA", { timeZone: zone }));
}

/** "today", "yesterday", "3 days ago", measured against the server's clock so both renders agree. */
export function updatedAgo(pushedAt: string, now: string, locale: string) {
  const days = Math.max(0, Math.round((calendarDay(now) - calendarDay(pushedAt)) / day));
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (days < 14) return format.format(-days, "day");
  if (days < 60) return format.format(-Math.round(days / 7), "week");
  return format.format(-Math.round(days / 30), "month");
}

export function ReleaseFeed({ activity }: { activity: ProjectActivity }) {
  const { site, locale } = useSiteCopy();
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: zone });
  // Release notes are written in English only.
  const notesLang = locale === "en" ? undefined : "en";
  return (
    <section id="releases" className={r.releases} data-reveal aria-labelledby="releases-heading">
      <div className={r.intro}>
        <h2 id="releases-heading" className={e.display}>{site["releases.heading"]} <em>{site["releases.emphasis"]}</em></h2>
        <p>{site["releases.body"]}</p>
        {activity.pushedAt && <p className={r.pulse}>
          <span aria-hidden className={r.dot} />
          {site["releases.updated"].replace("{when}", updatedAgo(activity.pushedAt, activity.now, locale))}
        </p>}
        <div className={r.links}>
          <a href={`${PROJECT_REPOSITORY}/releases`}>{site["releases.all"]} <ArrowUpRight size={16} aria-hidden /></a>
          <a href={`${PROJECT_REPOSITORY}/releases.atom`} type="application/atom+xml"><Rss size={15} aria-hidden /> {site["releases.feed"]}</a>
        </div>
      </div>
      <ol className={r.timeline}>
        {activity.releases.map((release, index) => (
          <li key={release.version} className={index === 0 ? r.latest : undefined}>
            <div className={r.meta}>
              <span className={r.version}>v{release.version}</span>
              {index === 0 && <span className={r.badge}>{site["releases.latest"]}</span>}
              <time dateTime={release.publishedAt}>{date.format(new Date(release.publishedAt))}</time>
            </div>
            <h3 lang={notesLang}>
              <a href={release.url}>{release.title.charAt(0).toUpperCase() + release.title.slice(1)}</a>
            </h3>
            {release.highlights.length > 0 && <ul lang={notesLang} aria-label={site["releases.highlights"].replace("{version}", release.version)}>
              {release.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
            </ul>}
          </li>
        ))}
      </ol>
    </section>
  );
}
