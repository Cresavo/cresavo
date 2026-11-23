"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "../../i18n";
import { switchSalon, useActiveWorkspace, useWorkspaceSlug } from "../../store";
import { showToast } from "../../ui/toast";
import { Button, ButtonLink } from "../../ui/button";
import { Card } from "../../ui/card";
import { PageHeader } from "../page-header";
import { useStudio } from "../use-studio";
import { firstVisit } from "./tour";
import { AccountNotice } from "./account-notice";
import { TrialNotice } from "./trial-notice";

export interface TourState {
  open: boolean;
  start: () => void;
  close: () => void;
  /** Attaches "Explore the demo salon", which gets focus back when the tour closes. */
  explore: (button: HTMLButtonElement | null) => void;
}

/** The demo tour on Today: open on the first visit to the demo salon, and again from "Explore the demo salon". */
export function useDemoTour(): TourState {
  const { state } = useStudio();
  const workspace = useActiveWorkspace();
  const [open, setOpen] = useState(() => workspace !== "account" && !state.industry && firstVisit());
  const button = useRef<HTMLButtonElement | null>(null);
  const explore = useCallback((element: HTMLButtonElement | null) => { button.current = element; }, []);
  const start = useCallback(() => setOpen(true), []);
  const close = useCallback(() => { setOpen(false); button.current?.focus(); }, []);
  return { open, start, close, explore };
}

/**
 * The way into a salon of one's own. On Today it is one quiet line at the end of the page, with the tour as a
 * text link; in Settings and setup it is the full card.
 */
interface EntryProps {
  standalone?: boolean;
  /** On Today: opens the tour, and attaches the button that gets focus back when it closes. */
  onExplore?: () => void;
  exploreRef?: TourState["explore"];
}

export function SalonEntry({ standalone = false, onExplore, exploreRef }: EntryProps) {
  const { state } = useStudio();
  const router = useRouter();
  const savedSalon = useWorkspaceSlug("own");
  const workspace = useActiveWorkspace();
  if (workspace === "account") return <AccountNotice />;
  if (state.industry) return <TrialNotice />;
  const resume = async () => { if (await switchSalon("own")) router.push("/studio"); else showToast(t("setup.switchFailed")); };
  if (onExplore) {
    return <p className="mt-12 flex flex-wrap items-center gap-x-4 text-sm text-text-secondary">
      <span className="py-3">{t(savedSalon ? "setup.saved" : "setup.intro")}</span>
      <span data-setup-entry className="rounded-md">{savedSalon
        ? <Button variant="link" onClick={resume}>{t("setup.resume")}</Button>
        : <ButtonLink variant="link" href="/studio/setup">{t("setup.entry")}</ButtonLink>}</span>
      <Button ref={exploreRef} variant="link" className="text-text-secondary" onClick={onExplore}>{t("setup.explore")}</Button>
    </p>;
  }
  return <div className="mb-5">
    <Card className="space-y-3 p-4">
      {standalone
        ? <PageHeader tools={false} title={t("setup.title")} subtitle={t(savedSalon ? "setup.saved" : "setup.intro")} />
        : <p className="font-medium">{t(savedSalon ? "setup.saved" : "setup.intro")}</p>}
      <div className="flex flex-wrap gap-2">
        <div data-setup-entry className="rounded-md">{savedSalon
          ? <Button onClick={resume}>{t("setup.resume")}</Button>
          : <ButtonLink href="/studio/setup">{t("setup.entry")}</ButtonLink>}</div>
        <ButtonLink href="/studio" variant="ghost">{t("setup.explore")}</ButtonLink>
      </div>
    </Card>
  </div>;
}
