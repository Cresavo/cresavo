import { ArrowUpRight, CalendarSync, CreditCard, Download, Globe, MonitorSmartphone, Sparkles } from "lucide-react";
import { Wordmark } from "../ui/wordmark";
import { PROJECT_REPOSITORY } from "../brand";
import { site } from "./en";
import e from "./editorial.module.css";
import h from "./open-design.module.css";

const nodes = [
  { key: "web", Icon: Globe }, { key: "ai", Icon: Sparkles }, { key: "pos", Icon: MonitorSmartphone },
  { key: "pay", Icon: CreditCard }, { key: "sync", Icon: CalendarSync }, { key: "export", Icon: Download },
] as const;

export function OpenDesign() {
  return (
    <section className={h.section} data-reveal>
      <div className={e.intro}><h2 className={e.display}>{site["hub.heading"]}</h2><p>{site["hub.intro"]}</p></div>
      <div className={h.diagram}>
        <svg className={h.wires} viewBox="0 0 100 300" preserveAspectRatio="none" aria-hidden>
          {[50, 150, 250].map(y => <g key={y}>
            <path d={`M0 ${y} C30 ${y} 28 150 50 150 S70 ${300-y} 100 ${300-y}`} pathLength="1" />
          </g>)}
        </svg>
        <a className={h.hub} href={`${PROJECT_REPOSITORY}#self-hosting`} aria-label={site["hub.guide"]}><Wordmark label="" /></a>
        {nodes.map(({key, Icon}) => <div key={key} className={h.node}>
          <Icon size={22} strokeWidth={1.5} aria-hidden /><div><strong>{key === "ai"
            ? <a href={`${PROJECT_REPOSITORY}/blob/main/docs/CONNECT_AI_ASSISTANT.md`} aria-label={site["hub.ai.guide"]}>{site["hub.ai"]} <ArrowUpRight size={12} aria-hidden /></a>
            : site[`hub.${key}`]}</strong><small>{site[`hub.${key}.caption`]}</small></div>
        </div>)}
      </div>
    </section>
  );
}
