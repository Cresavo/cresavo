import { useEffect, useRef, useState } from "react";
import { useSiteCopy } from "../copy";
import { Icon } from "./icons";
import { useMedia } from "./use-media";
import f from "./hero-flow.module.css";

/**
 * How long each cut stays up, in ms. Every cut adds one layer to the same screen: the empty calendar,
 * the client's ask, the assistant's offer, the filled slot, the confirmation, the reminder, then the
 * payoff line, held a little longer before the loop starts again.
 */
export const FLOW_STEPS = [1200, 1200, 1200, 1100, 1000, 1000, 2200] as const;
const HEADLINES = ["h0", "h1", "h2", "h3", "h4", "h5", "h6"] as const;

/** Runs the cuts while the flow is on screen and not paused. Reduced motion never starts it. */
function useFlow(stage: React.RefObject<HTMLDivElement | null>, paused: boolean, reduced: boolean) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const node = stage.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const watch = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    watch.observe(node);
    return () => watch.disconnect();
  }, [stage]);

  useEffect(() => {
    if (reduced || paused || !visible) return;
    const timer = setTimeout(() => setStep((now) => (now + 1) % FLOW_STEPS.length), FLOW_STEPS[step]);
    return () => clearTimeout(timer);
  }, [step, paused, visible, reduced]);

  return step;
}

/**
 * A static phone (a laptop from 900 px) while its screen cuts in rhythm and builds one booking:
 * calendar, ask, offer, filled slot, confirmation, reminder. Decorative and drawn from invented data, so
 * the picture is one labelled image. With reduced motion, or without scripts, only the final frame shows.
 */
export function HeroFlow({ demo }: { demo: string }) {
  const { site } = useSiteCopy();
  const stage = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const reduced = useMedia("(prefers-reduced-motion: reduce)", false);
  const step = useFlow(stage, paused, reduced);
  const on = (from: number) => (step >= from ? "" : undefined);

  return (
    <div className={f.flow}>
      <div className={f.device} ref={stage}>
        <div className={f.frame} role="img" aria-label={site["home.flow.label"]}>
          <div className={f.screen} data-step={step}>
            <div className={f.bar}>
              <span>{site["home.flow.salon"]}</span>
              <span>{site["home.flow.day"]}</span>
            </div>
            <div className={f.headline}>
              {HEADLINES.map((key, i) => (
                <p key={key} className={f.hl} data-on={step === i ? "" : undefined}>{site[`home.flow.${key}`]}</p>
              ))}
            </div>
            <div className={f.stack}>
              <div className={f.cal}>
                {["13:00", "14:00", "15:00"].map((time) => (
                  <div key={time} className={f.row}>
                    <span className={f.time}>{time}</span>
                    <span className={f.slot}>
                      {time === "14:00" && (
                        <span className={`${f.booking} ${f.layer}`} data-on={on(3)}>
                          <b>{site["home.flow.who"]}</b> · {site["home.service.spa"]}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <div className={f.chat}>
                <p className={`${f.bubble} ${f.me} ${f.layer}`} data-on={on(1)}>{site["home.next.ask"]}</p>
                <p className={`${f.bubble} ${f.ai} ${f.layer}`} data-on={on(2)}>{site["home.flow.offer"]}</p>
                <p className={`${f.bubble} ${f.me} ${f.layer}`} data-on={on(3)}>{site["home.flow.yes"]}</p>
                <p className={`${f.status} ${f.layer}`} data-on={on(4)}>
                  <Icon name="cal" className={f.ic} />{site["home.flow.booked"]}
                </p>
                <p className={`${f.status} ${f.layer}`} data-on={on(5)}>
                  <Icon name="chat" className={f.ic} />
                  <span><b>{site["home.flow.reminder"]}</b><br />{site["home.flow.reminder.text"]}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className={f.base} aria-hidden="true" />
      </div>
      <div className={f.under}>
        <a className={f.cta} href={demo}>{site["home.demo"]} <Icon name="arrow" className={f.ic} /></a>
        <button type="button" className={f.pause} aria-pressed={paused} onClick={() => setPaused(!paused)}>
          {paused ? site["home.flow.play"] : site["home.flow.pause"]}
        </button>
      </div>
      <p className={f.note}>{site["home.flow.note"]}</p>
    </div>
  );
}
