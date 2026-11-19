import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowRight, Check, RotateCcw } from "lucide-react";
import { PALETTES } from "../page/theme";
import { useSiteCopy } from "./copy";
import s from "./site.module.css";

const times = ["10:15", "13:00", "14:45"];

// A standalone sample of the salon page. Choices live only for this visit.
export function MiniBooking() {
  const { site } = useSiteCopy();
  const treatments = [
    { name: site["mini.basic"], details: site["mini.basic.details"] },
    { name: site["mini.spa"], details: site["mini.spa.details"] },
  ];
  const [treatment, setTreatment] = useState<(typeof treatments)[number]>();
  const [time, setTime] = useState("");
  const title = useRef<HTMLHeadingElement>(null);
  const interacted = useRef(false);
  useEffect(() => {
    if (interacted.current) title.current?.focus({ preventScroll: true });
  }, [treatment, time]);

  return (
    <section className={s.mini} aria-label={site["mini.label"]} style={{
      "--salon-bg": PALETTES.forest.background,
      "--salon-text": PALETTES.forest.text,
      "--salon-action": PALETTES.forest.accent,
    } as CSSProperties}>
      <div className={s.miniPhoto} />
      <div className={s.miniBody}>
        <p className={s.salonName}>{site["mini.salon"]}</p>
        <h2 ref={title} tabIndex={-1}>{time ? site["mini.booked"] : treatment ? site["mini.pickTime"] : site["mini.pickTreatment"]}</h2>
        {time && treatment ? (
          <>
            <p className={s.miniSummary}><Check size={16} aria-hidden /> {time} · {treatment.name}</p>
            <button className={s.miniReset} onClick={() => { setTime(""); setTreatment(undefined); }}>
              <RotateCcw size={14} aria-hidden /> {site["mini.reset"]}
            </button>
          </>
        ) : treatment ? (
          <>
            <p className={s.miniMeta}>{treatment.name}</p>
            <div className={s.miniTimes}>{times.map(slot => <button key={slot} onClick={() => setTime(slot)}>{slot}</button>)}</div>
          </>
        ) : (
          <div className={s.miniChoices}>{treatments.map(item => (
            <button key={item.name} onClick={() => { interacted.current = true; setTreatment(item); }}>
              <span>{item.name}<small>{item.details}</small></span><ArrowRight size={15} aria-hidden />
            </button>
          ))}</div>
        )}
      </div>
    </section>
  );
}
