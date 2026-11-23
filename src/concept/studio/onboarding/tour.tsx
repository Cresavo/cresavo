import { useEffect, useRef, useState } from "react";
import { t } from "../../i18n";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";

const seenKey = "studio-tour-seen-v1";
let seenInSession = false;

export function firstVisit() {
  try { return !seenInSession && !localStorage.getItem(seenKey) && !localStorage.getItem("salong-eko-demo"); }
  catch { return !seenInSession; }
}

const steps = [
  { target: '[data-help="/studio"]', title: "setup.tour1", hint: "setup.tour1Hint" },
  { target: '[data-help="/studio/calendar"]', title: "setup.tour2", hint: "setup.tour2Hint" },
  { target: '[data-setup-entry]', title: "setup.tour3", hint: "setup.tour3Hint" },
] as const;

/** A modeless coach mark keeps the highlighted navigation and the setup link usable. */
export function DemoTour({ close }: { close: () => void }) {
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const current = steps[step];
  useEffect(() => {
    seenInSession = true;
    try { localStorage.setItem(seenKey, "1"); } catch { /* Session fallback. */ }
  }, []);
  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>(current.target));
    for (const target of targets) target.setAttribute("data-tour-active", "");
    heading.current?.focus({ preventScroll: true });
    return () => { for (const target of targets) target.removeAttribute("data-tour-active"); };
  }, [current]);
  return <Card role="dialog" onKeyDown={event => {
    if (event.key === "Escape") { event.stopPropagation(); close(); }
  }} aria-labelledby="tour-heading" aria-describedby="tour-hint" className="mt-3 space-y-1 p-4">
    <p className="text-xs font-medium text-text-secondary">{t("setup.step", { step: step + 1, total: steps.length })}</p>
    <h2 id="tour-heading" ref={heading} tabIndex={-1} className="w-fit rounded-sm text-h3 font-semibold">{t(current.title)}</h2>
    <p id="tour-hint" className="text-sm text-text-secondary">{t(current.hint)}</p>
    <div className="flex flex-wrap gap-2 pt-2"><Button size="sm" onClick={() => step === steps.length - 1 ? close() : setStep(step + 1)}>{t(step === steps.length - 1 ? "setup.tourEnd" : "welcome.next")}</Button>
      <Button size="sm" variant="ghost" onClick={close}>{t("setup.tourSkip")}</Button></div>
  </Card>;
}
