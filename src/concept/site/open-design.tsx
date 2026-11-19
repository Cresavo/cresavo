import { ArrowUpRight, CalendarDays, Check, CreditCard, Download, Globe, MonitorSmartphone, Sparkles } from "lucide-react";
import { Wordmark } from "../ui/wordmark";
import { PROJECT_REPOSITORY } from "../brand";
import { useSiteCopy } from "./copy";
import e from "./editorial.module.css";
import h from "./open-design.module.css";

const nodes = [
  { key: "web", Icon: Globe }, { key: "export", Icon: Download },
  { key: "ai", Icon: Sparkles }, { key: "sync", Icon: CalendarDays },
  { key: "pos", Icon: MonitorSmartphone }, { key: "pay", Icon: CreditCard },
] as const;

// The SVG occupies the middle grid track. Its ports meet the centre of each equal-height row.
const paths = [50, 150, 250].flatMap(y => [
  `M50 150 C26 150 26 ${y} 0 ${y}`, `M50 150 C74 150 74 ${y} 100 ${y}`,
]);

export function OpenDesign() {
  const { site } = useSiteCopy();
  return (
    <section className={h.section} id="connections" aria-labelledby="tools-title">
      <div className={e.intro}><h2 id="tools-title" className={e.display}>{site["hub.heading"]}</h2><p>{site["hub.intro"]}</p></div>
      <div className={h.diagram}>
        <svg className={h.wires} viewBox="0 0 100 300" preserveAspectRatio="none" aria-hidden>
          {paths.map(d => <g key={d}><path d={d} /><path className={h.pulse} d={d} pathLength="100" /></g>)}
        </svg>
        <a className={h.hub} href={`${PROJECT_REPOSITORY}#self-hosting`} aria-label={site["hub.guide"]}><Wordmark label="" /></a>
        {nodes.map(({key, Icon}) => {
          const planned = key === "pos" || key === "pay";
          return <div key={key} className={h.node}>
            <div className={h.title}><Icon size={19} aria-hidden /><h3>{key === "ai"
              ? <a href={`${PROJECT_REPOSITORY}/blob/main/docs/CONNECT_AI_ASSISTANT.md`} aria-label={site["hub.ai.guide"]}>{site["hub.ai"]} <ArrowUpRight size={12} aria-hidden /></a>
              : site[`hub.${key}`]}</h3></div>
            <p>{site[`hub.${key}.caption`]}</p>
            <small data-planned={planned}>{!planned && <Check size={11} aria-hidden />}{site[planned ? "hub.planned" : "hub.available"]}</small>
          </div>;
        })}
      </div>
    </section>
  );
}
