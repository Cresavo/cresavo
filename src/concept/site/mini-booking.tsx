import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowRight, Check, RotateCcw } from "lucide-react";
import { DEFAULT_THEME, PALETTES, themeVariables } from "../page/theme";
import { Button } from "../ui/button";
import { ListRow } from "../ui/list-row";
import { useSiteCopy } from "./copy";
import s from "./site.module.css";

const times = ["10:15", "13:00", "14:45"];
const { colorScheme, ...salonColors } = themeVariables({ ...DEFAULT_THEME, colors: PALETTES.forest });

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
    <section className={s.mini} data-scheme={colorScheme} aria-label={site["mini.label"]} style={salonColors as CSSProperties}>
      <div className={s.miniPhoto} />
      <div className={s.miniBody}>
        <p className={s.salonName}>{site["mini.salon"]}</p>
        <h2 ref={title} tabIndex={-1}>{time ? site["mini.booked"] : treatment ? site["mini.pickTime"] : site["mini.pickTreatment"]}</h2>
        {time && treatment ? (
          <>
            <p className={s.miniSummary}><Check size={16} aria-hidden /> {time} · {treatment.name}</p>
            <Button variant="secondary" onClick={() => { setTime(""); setTreatment(undefined); }}>
              <RotateCcw size={14} aria-hidden /> {site["mini.reset"]}
            </Button>
          </>
        ) : treatment ? (
          <>
            <p className={s.miniMeta}>{treatment.name}</p>
            <div className={s.miniTimes}>{times.map(slot => <Button variant="secondary" key={slot} onClick={() => setTime(slot)}>{slot}</Button>)}</div>
          </>
        ) : (
          <div className={s.miniChoices}>{treatments.map(item => (
            <ListRow key={item.name} className="bg-surface ring-1 ring-inset ring-input-border" title={item.name} meta={item.details}
              trailing={<ArrowRight size={15} aria-hidden />} onClick={() => { interacted.current = true; setTreatment(item); }} />
          ))}</div>
        )}
      </div>
    </section>
  );
}
