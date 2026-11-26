"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { helpEntry, helpSteps } from "../../help/map/entries";
import type { HelpEntry } from "../../help/map/types";
import { clickFor, clickTarget, currentAnchor, findAnchor, mayClickFor, onRoute } from "../../help/pointer/dom";
import { steerFor, type Steer } from "../../help/pointer/steer";
import { moveShowMe, stopShowMe, useShowMe } from "../../help/pointer/store";
import { t, type MessageKey } from "../../i18n";
import { moduleEnabled } from "../../modules/registry";
import { canOpen } from "../../ops/access";
import { useRole } from "../../ops/role";
import { Button, IconButton } from "../../ui/button";
import { friendlyMessage, FriendlyNotice, logForSupport } from "../../ui/friendly-message";
import { highlight } from "../../ui/highlight";
import { useStudio } from "../use-studio";

const POLL_MS = 120;
/** How long a clicked step may take to show the next element before the guide opens its page itself. */
const NAVIGATE_AFTER_MS = 700;
const GIVE_UP_MS = 4500;
/** How long a page with nothing to point at is given to draw its list before the guide calls it empty. */
const EMPTY_AFTER_MS = 1500;
const GAP = 12;
/** How often a shown step checks that its element is still the current one (a day change replaces bookings). */
const WATCH_MS = 400;

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
  /** A step whose list has nothing fitting on screen: the guide explains and points elsewhere (another day, Import). */
  const [steer, setSteer] = useState<{ index: number; plan: Steer } | null>(null);
  /** A step whose press did not go through: from then on the guide only points at it. */
  const [unpressable, setUnpressable] = useState<number | null>(null);
  // Going back past a step this layout does not have (the phone's tab bar on a desktop) skips it the same way.
  const direction = useRef<1 | -1>(1);
  const blocker: "module" | "owner" | null = step.module && !moduleEnabled(state.modules, step.module) ? "module"
    : !canOpen(role, step.route) ? "owner" : null;
  const target = found?.index === index ? found.element : null;
  const steering = steer?.index === index ? steer.plan : null;

  const go = (next: number) => {
    direction.current = next < index ? -1 : 1;
    setMissing(null);
    setSteer(null);
    moveShowMe(next);
  };

  /** The step whose list was empty when the owner was pointed elsewhere; leaving its page ends the guide. */
  const steeredStep = useRef<number | null>(null);

  // Find the step's element; open its page when it does not turn up by itself.
  useEffect(() => {
    if (blocker) return;
    // The owner took the way the guide pointed to instead (Import, another page): that is where they meant to go.
    if (steeredStep.current === index && !onRoute(pathname, step.route)) return stopShowMe();
    let timer = 0;
    let opened = false;
    // Counted rather than read from the clock, which a page (or a test) may hold still.
    let waited = 0;
    let steered: Steer | null = null;
    const visible = (ids: readonly string[]) =>
      ids.map((id) => findAnchor(id)).find((lookup): lookup is { element: HTMLElement } => typeof lookup === "object")?.element ?? null;
    const look = () => {
      const result = findAnchor(step.id, entry.prefer);
      if (typeof result === "object") {
        // Found, but keep watching: a day change or a filter can replace or remove it before the owner presses it.
        const element = result.element;
        setMissing(null);
        setSteer(null);
        setFound((current) => (current?.index === index && current.element === element ? current : { index, element }));
        steered = null;
        steeredStep.current = null;
        waited = 0;
        timer = window.setTimeout(look, WATCH_MS);
        return;
      }
      // Gone or covered: drop the old outline and search (or steer) again.
      setFound((current) => (current?.index === index && !steered ? null : current));
      const onPage = onRoute(pathname, step.route);
      steered ??= steerFor(step, entry, result, { onPage, settled: waited >= EMPTY_AFTER_MS || !!visible(step.empty?.pointAt ?? []) });
      if (steered) {
        // Nothing fitting in the list here (no finished visit, an empty day, no customers yet): never open the wrong
        // thing. Explain, point at the way to find one, and go on by ourselves when it shows up or the owner opens it.
        const plan = steered;
        steeredStep.current = index;
        setMissing(null);
        setSteer((current) => (current?.index === index && current.plan === plan ? current : { index, plan }));
        const ahead = steps[index + 1];
        if (ahead && typeof findAnchor(ahead.id) === "object") {
          direction.current = 1;
          return moveShowMe(index + 1);
        }
        const element = visible(plan.pointAt);
        setFound((current) => (current?.index === index && current.element === element ? current : element && { index, element }));
        timer = window.setTimeout(look, POLL_MS * 2);
        return;
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
      if (waited > GIVE_UP_MS && result !== "blocked") setMissing(index);
      const pause = waited > GIVE_UP_MS ? POLL_MS * 4 : POLL_MS;
      waited += pause;
      timer = window.setTimeout(look, pause);
    };
    look();
    return () => window.clearTimeout(timer);
  }, [blocker, entry, index, pathname, router, step, steps]);

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
      // Another day's arrow only changes the day, and the guide goes on once a fitting visit is there. Pressing
      // something that starts a change instead (New booking, Add treatment) ends the guide: the owner has taken over.
      if (steering) {
        if (helpEntry(target.dataset.helpId ?? "")?.safety === "changes-data") stopShowMe();
        return;
      }
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
  }, [hintId, index, last, step, steering, target]);

  // Closing leaves keyboard focus on the element the guide pointed at, ready to press.
  const finish = () => {
    stopShowMe();
    target?.focus({ preventScroll: true });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // While the owner works in a sheet of their own, Escape closes that sheet, not the guide.
      if (event.key !== "Escape" || aside(topLayer(), target)) return;
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
  // The owner opened a sheet of their own (calendar options, a booking): step aside until it closes, never cover it.
  if (!place.host || aside(place.host, target)) return null;

  const changes = !mayClickFor(step);
  // "Take me there" only when the element is one control now; a group, or a press that failed, is only pointed at.
  const control = target && !steering && !changes && !step.pointOnly && unpressable !== index ? clickTarget(target) : null;
  const pointing = !!target && !steering && !changes && !control;
  const takeMe = () => {
    if (!target || !control) return;
    // Pressed only if the outlined element is still the page's current one; a replaced one is found again first.
    const now = currentAnchor(step.id, entry.prefer, target);
    if (!now) return setFound(null);
    try {
      clickFor(step, now);
    } catch (error) {
      logForSupport("SHOW_ME_PRESS_FAILED", error);
      setUnpressable(index);
      return;
    }
    if (last) stopShowMe();
    else go(index + 1);
  };
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
        {steering ? (
          <FriendlyNotice message={steering.kind === "unmatched" && entry.prefer
            ? friendlyMessage({ what: `showMe.unmatched.${entry.prefer}.what`, next: `showMe.unmatched.${entry.prefer}.next` })
            : friendlyMessage({ what: `showMe.${step.id}.empty.what` as MessageKey, next: `showMe.${step.id}.empty.next` as MessageKey })} />
        ) : blocker || missing === index ? (
          <Blocked step={step} reason={blocker ?? "missing"} />
        ) : (
          <>
            <p id={hintId} className="text-body text-text-secondary">{target ? t(`showMe.${step.id}.hint` as MessageKey) : t("showMe.looking", { label })}</p>
            {target && last && changes && <p className="text-body font-medium">{t("showMe.yourTurn")}</p>}
            {pointing && <p className="text-body font-medium">{t("showMe.pointHint")}</p>}
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {index > 0 && <Button variant="secondary" size="sm" onClick={() => go(index - 1)}>{t("showMe.back")}</Button>}
        {control && <Button size="sm" onClick={takeMe}>{t("showMe.takeMe")}</Button>}
        {pointing && !last && <Button size="sm" onClick={() => go(index + 1)}>{t("showMe.next")}</Button>}
        {(last || steering) && !control && <Button size="sm" variant={target ? "primary" : "secondary"} onClick={finish}>{t("showMe.done")}</Button>}
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

/** A sheet is open on top that does not hold what the guide points at. */
function aside(host: HTMLElement, target: HTMLElement | null): boolean {
  return host instanceof HTMLDialogElement && !(target && host.contains(target));
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
