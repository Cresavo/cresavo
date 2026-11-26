"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { helpSteps } from "../../help/map/entries";
import type { HelpEntry } from "../../help/map/types";
import { clickFor, findAnchor, mayClickFor, onRoute } from "../../help/pointer/dom";
import { moveShowMe, stopShowMe, useShowMe } from "../../help/pointer/store";
import { t, type MessageKey } from "../../i18n";
import { moduleEnabled } from "../../modules/registry";
import { canOpen } from "../../ops/access";
import { useRole } from "../../ops/role";
import { Button, IconButton } from "../../ui/button";
import { friendlyMessage, FriendlyNotice } from "../../ui/friendly-message";
import { highlight } from "../../ui/highlight";
import { useStudio } from "../use-studio";

const POLL_MS = 120;
/** How long a clicked step may take to show the next element before the guide opens its page itself. */
const NAVIGATE_AFTER_MS = 700;
const GIVE_UP_MS = 4500;
const GAP = 12;

/** The "Show me" guide: a dot and an outline on the element, and a caption card with the steps. Mounted once by the shell. */
export function ShowMePointer() {
  const guide = useShowMe();
  if (!guide) return null;
  return <Guide key={guide.entryId} entryId={guide.entryId} index={guide.index} />;
}

type Found = { index: number; element: HTMLElement };

function Guide({ entryId, index: asked }: { entryId: string; index: number }) {
  const { state } = useStudio();
  const role = useRole();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const steps = useMemo(() => helpSteps(entryId), [entryId]);
  const entry = steps[steps.length - 1];
  const index = Math.min(asked, steps.length - 1);
  const step = steps[index];
  const last = index === steps.length - 1;
  const [found, setFound] = useState<Found | null>(null);
  const [missing, setMissing] = useState<number | null>(null);
  // Going back past a step this layout does not have (the phone's tab bar on a desktop) skips it the same way.
  const direction = useRef<1 | -1>(1);
  const blocker: "module" | "owner" | null = step.module && !moduleEnabled(state.modules, step.module) ? "module"
    : !canOpen(role, step.route) ? "owner" : null;
  const target = found?.index === index ? found.element : null;

  const go = (next: number) => {
    direction.current = next < index ? -1 : 1;
    setMissing(null);
    moveShowMe(next);
  };

  // Find the step's element; open its page when it does not turn up by itself.
  useEffect(() => {
    if (blocker) return;
    let timer = 0;
    let opened = false;
    // Counted rather than read from the clock, which a page (or a test) may hold still.
    let waited = 0;
    const look = () => {
      const result = findAnchor(step.id, entry.prefer);
      if (typeof result === "object") {
        setMissing(null);
        return setFound({ index, element: result.element });
      }
      if (result === "hidden") {
        // This layout does not have it (the phone's tab bar on a desktop): the next step shows the way instead.
        const skip = index + direction.current;
        if (skip >= 0 && skip < steps.length) return moveShowMe(skip);
        if (skip < 0) return moveShowMe(index + 1);
        return setMissing(index);
      }
      if (!opened && waited > NAVIGATE_AFTER_MS && !step.global && !onRoute(pathname, step.route) && !step.route.includes("[")) {
        opened = true;
        router.push(step.route);
      }
      // Say so after a while, but keep looking: a slow page or a sheet the owner opens still brings it.
      if (waited > GIVE_UP_MS) setMissing(index);
      const pause = waited > GIVE_UP_MS ? POLL_MS * 4 : POLL_MS;
      waited += pause;
      timer = window.setTimeout(look, pause);
    };
    look();
    return () => window.clearTimeout(timer);
  }, [blocker, entry.prefer, index, pathname, router, step, steps.length]);

  const heading = useRef<HTMLHeadingElement>(null);
  const hintId = useId();
  const headingId = useId();

  // Outline the element, bring it into view, read the caption with it, and follow the owner's own click.
  useEffect(() => {
    if (!target) return;
    const clear = highlight([target]);
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // A tall section shows from its start, where its title and first control are.
    const tall = target.getBoundingClientRect().height > window.innerHeight * 0.4;
    target.scrollIntoView({ block: tall ? "start" : "center", inline: "nearest", behavior: still ? "auto" : "smooth" });
    const described = target.getAttribute("aria-describedby");
    target.setAttribute("aria-describedby", [described, hintId].filter(Boolean).join(" "));
    heading.current?.focus({ preventScroll: true });
    const followed = () => {
      if (last) stopShowMe();
      else if (mayClickFor(step)) {
        direction.current = 1;
        moveShowMe(index + 1);
      }
    };
    target.addEventListener("click", followed);
    return () => {
      clear();
      target.removeEventListener("click", followed);
      if (described) target.setAttribute("aria-describedby", described);
      else target.removeAttribute("aria-describedby");
    };
  }, [hintId, index, last, step, target]);

  // Closing leaves keyboard focus on the element the guide pointed at, ready to press.
  const finish = () => {
    stopShowMe();
    target?.focus({ preventScroll: true });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      stopShowMe();
      target?.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [target]);

  const card = useRef<HTMLElement>(null);
  const origin = useRef<HTMLSpanElement>(null);
  const place = usePlacement(target, card, origin);
  if (!place.host) return null;

  const takeMe = () => {
    if (!target) return;
    clickFor(step, target);
    if (last) stopShowMe();
    else go(index + 1);
  };
  const changes = !mayClickFor(step);
  const label = t(step.label);

  return createPortal(<>
    {/* Where "fixed" starts: a sheet that slides in moves it, and the guide's card may sit inside the sheet. */}
    <span ref={origin} aria-hidden className="studio-show-me-origin" />
    {target && place.dot && <span aria-hidden className="studio-show-me-dot" style={place.dot} />}
    <section ref={card} role="dialog" aria-modal="false" aria-labelledby={headingId} aria-describedby={hintId}
      className="studio-show-me-card" style={place.card}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-meta text-text-secondary">{t("showMe.step", { step: index + 1, total: steps.length })}</p>
        <IconButton label={t("showMe.close")} onClick={finish} className="-my-2 -mr-2"><X size={18} aria-hidden /></IconButton>
      </div>
      <h2 id={headingId} ref={heading} tabIndex={-1} style={{ outline: "none" }} className="text-h3 font-semibold">{label}</h2>
      <div aria-live="polite" className="space-y-2">
        {blocker || missing === index ? (
          <Blocked step={step} reason={blocker ?? "missing"} />
        ) : (
          <>
            <p id={hintId} className="text-body text-text-secondary">{target ? t(`showMe.${step.id}.hint` as MessageKey) : t("showMe.looking", { label })}</p>
            {target && last && changes && <p className="text-body font-medium">{t("showMe.yourTurn")}</p>}
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {index > 0 && <Button variant="secondary" size="sm" onClick={() => go(index - 1)}>{t("showMe.back")}</Button>}
        {target && !changes && <Button size="sm" onClick={takeMe}>{t("showMe.takeMe")}</Button>}
        {last && (changes || !target) && <Button size="sm" variant={target ? "primary" : "secondary"} onClick={finish}>{t("showMe.done")}</Button>}
      </div>
    </section>
  </>, place.host);
}

function Blocked({ step, reason }: { step: HelpEntry; reason: "module" | "owner" | "missing" }) {
  const vars = { label: t(step.label) };
  const message = reason === "module"
    ? friendlyMessage({ what: "showMe.moduleOff.what", next: "showMe.moduleOff.next", showMe: "features.switches" }, vars)
    : reason === "owner"
      ? friendlyMessage({ what: "showMe.staffOnly.what", next: "showMe.staffOnly.next", showMe: "advanced.staff-preview" }, vars)
      : friendlyMessage({ what: "showMe.missing.what", next: "showMe.missing.next" }, vars);
  return <FriendlyNotice message={message} />;
}

interface Placement {
  host: HTMLElement | null;
  card: CSSProperties;
  dot?: CSSProperties;
}

/** The open modal dialog on top, which keeps the rest of the page out of reach, or the studio. */
function topLayer(): HTMLElement {
  const modal = [...document.querySelectorAll<HTMLDialogElement>("dialog[open]")].filter((dialog) => dialog.matches(":modal"));
  return modal.at(-1) ?? document.querySelector<HTMLElement>(".studio-root") ?? document.body;
}

const same = (a: Placement, b: Placement) =>
  a.host === b.host && JSON.stringify([a.card, a.dot]) === JSON.stringify([b.card, b.dot]);

/**
 * Where the card and the dot go, measured every frame while the guide is open: the element moves when the page
 * scrolls or a sheet slides in. On a phone the card docks above the tab bar, or at the top when the element is down
 * there; on a wide screen it sits below, above or beside the element. It never covers the element.
 */
function usePlacement(target: HTMLElement | null, card: RefObject<HTMLElement | null>, origin: RefObject<HTMLElement | null>): Placement {
  const [place, setPlace] = useState<Placement>({ host: null, card: {} });
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      // Inside an open sheet the card has to stay within the sheet, which clips what lies outside it.
      const host = topLayer();
      const view = host instanceof HTMLDialogElement ? host.getBoundingClientRect()
        : { top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight, width: window.innerWidth };
      const height = card.current?.getBoundingClientRect().height ?? 180;
      const phone = window.innerWidth < 640;
      const width = phone ? view.width - 2 * GAP : Math.min(view.width - 2 * GAP, 360);
      const rect = target?.getBoundingClientRect();
      const tabs = document.querySelector("[data-tab-bar]")?.getBoundingClientRect();
      const floor = Math.min(view.bottom, tabs && tabs.height > 0 ? tabs.top : view.bottom) - GAP;
      const ceiling = view.top + GAP;
      const bottomDock = floor - height;
      let top = bottomDock;
      let left = phone ? view.left + GAP : Math.min(Math.max(rect?.left ?? 0, view.left + GAP), view.right - width - GAP);
      if (rect && phone) {
        top = rect.bottom + GAP <= bottomDock ? bottomDock : rect.top - GAP >= ceiling + height ? ceiling
          : rect.top > (view.top + floor) / 2 ? ceiling : bottomDock;
      } else if (rect) {
        if (rect.bottom + GAP + height <= floor) top = rect.bottom + GAP;
        else if (rect.top - GAP - height >= ceiling) top = rect.top - GAP - height;
        else {
          top = Math.min(Math.max(rect.top, ceiling), floor - height);
          left = rect.right + GAP + width <= view.right - GAP ? rect.right + GAP : Math.max(view.left + GAP, rect.left - GAP - width);
        }
      }
      const zero = origin.current?.getBoundingClientRect() ?? { top: 0, left: 0 };
      // The dot sits on the element's top left corner, clear of whatever is beside it.
      const dot = rect && { transform: `translate(${Math.round(Math.max(rect.left, 2) - 7 - zero.left)}px, ${Math.round(Math.max(rect.top, 2) - 7 - zero.top)}px)` };
      const next: Placement = { host, card: { top: Math.round(top - zero.top), left: Math.round(left - zero.left), width: Math.round(width) }, dot };
      setPlace((current) => (same(current, next) ? current : next));
      frame = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(frame);
  }, [target, card, origin]);
  return place;
}
