import { useState } from "react";
import Image from "next/image";
import { ArrowRight, CalendarDays, CalendarCheck2, Check, LayoutDashboard, Smartphone, Sparkles } from "lucide-react";
import { site } from "./en";
import e from "./editorial.module.css";
import c from "./studio-preview.module.css";

const views = [
  { key: "today", icon: LayoutDashboard },
  { key: "calendar", icon: CalendarDays },
  { key: "booking", icon: Smartphone },
  { key: "assistant", icon: Sparkles },
] as const;
type View = typeof views[number]["key"];

export function StudioPreview() {
  const [selected, setSelected] = useState<View>("today");
  const [seen, setSeen] = useState<Set<View>>(new Set(["today"]));
  return (
    <section className={c.showcase} aria-labelledby="studio-title" data-reveal>
      <div className={c.menu}>
        <h2 className={e.display} id="studio-title">{site["studio.heading"]}</h2>
        <div className={c.choices} role="group" aria-label={site["studio.controls"]}>
          {views.map(({ key, icon: Icon }) => <button key={key} aria-pressed={selected === key}
            onClick={() => { setSelected(key); setSeen(previous => new Set(previous).add(key)); }}>
            <Icon size={18} aria-hidden />{site[`studio.${key}`]}<ArrowRight size={16} aria-hidden />
          </button>)}
        </div>
      </div>
      <figure className={c.demo}>
        <div className={c.stage}>
          {views.map(({ key }) => seen.has(key) && <div key={key} className={c.layer} data-active={selected === key} aria-hidden={selected !== key}>
            {key === "booking" ? <div className={c.phone}><Image src="/site/view-booking.webp" alt={site["studio.booking.alt"]} width={390} height={780} unoptimized /></div>
            : <div className={c.desktop}>
              <div className={c.chrome} aria-hidden><i /><i /><i /><span>{site["mini.salon"]}</span></div>
              <picture>
                <source media="(prefers-color-scheme: dark)" srcSet={`/site/view-${key}-dark.webp`} />
                <img src={`/site/view-${key}-light.webp`} alt={site[`studio.${key}.alt`]} width="1120" height="760" loading="lazy" />
              </picture>
            </div>}
            {key === "today" && <div className={c.notice} aria-hidden>
              <CalendarCheck2 size={22} /><span><strong>{site["studio.notification"]}</strong><small>{site["studio.confirmation"]}</small></span><Check size={16} />
            </div>}
          </div>)}
        </div>
        <figcaption aria-live="polite"><strong>{site[`studio.${selected}`]}</strong>{site[`studio.${selected}.caption`]}</figcaption>
      </figure>
    </section>
  );
}
