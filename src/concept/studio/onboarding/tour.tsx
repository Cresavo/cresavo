import { useEffect, useRef, useState } from "react";
import { t } from "../../i18n";
import { useWorkspaceSlug } from "../../store";
import { Button, ButtonLink } from "../../ui/button";
import { highlight } from "../../ui/highlight";

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
    const clear = highlight(document.querySelectorAll(current.target));
    heading.current?.focus({ preventScroll: true });
    return clear;
  }, [current]);
  const last = step === steps.length - 1;
  // The last step points at the way into setup at the end of the page, so the link is here as well.
  const savedSalon = useWorkspaceSlug("own");
  return <section role="dialog" onKeyDown={event => {
    if (event.key === "Escape") { event.stopPropagation(); close(); }
  }} aria-labelledby="tour-heading" aria-describedby="tour-hint" className="border-l-2 border-action pl-4">
    <p className="text-sm text-text-secondary">{t("setup.step", { step: step + 1, total: steps.length })}</p>
    {/* Focus moves to the heading so it is read out; it is not a control, so it has no focus ring. */}
    <h2 id="tour-heading" ref={heading} tabIndex={-1} style={{ outline: "none" }} className="mt-1 text-h3 font-semibold">{t(current.title)}</h2>
    <p id="tour-hint" className="mt-1 max-w-reading text-sm text-text-secondary">{t(current.hint)}</p>
    <div className="flex flex-wrap gap-x-5">
      {last && !savedSalon && <ButtonLink variant="link" href="/studio/setup">{t("setup.entry")}</ButtonLink>}
      <Button variant="link" className="font-semibold" onClick={() => last ? close() : setStep(step + 1)}>{t(last ? "setup.tourEnd" : "welcome.next")}</Button>
      {!last && <Button variant="link" className="text-text-secondary" onClick={close}>{t("setup.tourSkip")}</Button>}
    </div>
  </section>;
}
