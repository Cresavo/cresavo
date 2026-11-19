"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Save, Undo2 } from "lucide-react";
import { t } from "../../i18n";
import { normalizePage, type PageConfig } from "../../page/config";
import { applyTemplate } from "../../page/templates";
import type { PageSection } from "../../page/sections";
import type { PageTheme } from "../../page/theme";
import { dispatchWithLog } from "../../store";
import { Button } from "../../ui/button";
import { Card, Section } from "../../ui/card";
import { Segmented } from "../../ui/controls";
import { StickyActionBar } from "../../ui/sticky-action-bar";
import { ADVANCED_PAGE } from "../nav";
import { useStudio } from "../use-studio";
import { Preview } from "./preview";
import { SectionControls } from "./section-controls";
import { TemplatePicker } from "./template-picker";
import { ThemeControls } from "./theme-controls";
import { showUndoToast } from "../log/undo-toast";

/** Booking page editor: controls on one side, the real page with the draft on the other. Nothing changes for customers until Save. */
export function PageEditor() {
  const { state } = useStudio();
  const [draft, setDraft] = useState<PageConfig>(state.page);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const saved = JSON.stringify(state.page);
  const dirty = JSON.stringify(normalizePage(draft)) !== saved;
  const change = (patch: Partial<PageConfig>) => setDraft((current) => ({ ...current, ...patch }));
  const theme = (patch: Partial<PageTheme>) => setDraft((current) => ({ ...current, theme: { ...current.theme, ...patch } }));
  const hiddenReview = state.modules.reviews ? -1 : draft.sections.findIndex((section) => section.kind === "reviews");
  const visibleSections = draft.sections.filter((section, index) => index !== hiddenReview);
  const changeSections = (sections: PageSection[]) => {
    if (hiddenReview < 0) {
      change({ sections });
      return;
    }
    const next = [...sections];
    const index = Math.max(sections[0]?.kind === "hero" ? 1 : 0, hiddenReview);
    next.splice(index, 0, draft.sections[hiddenReview]);
    change({ sections: next });
  };

  const save = () => {
    const logId = dispatchWithLog({ type: "page/set", page: draft });
    if (logId === false) return;
    setDraft(normalizePage(draft));
    showUndoToast(t("pageEditor.saved"), logId, () => setDraft(JSON.parse(saved) as PageConfig));
  };

  return (
    <div className="space-y-4">
      <Segmented
        label={t("pageEditor.view")}
        value={view}
        onChange={setView}
        options={[
          { value: "edit", label: t("pageEditor.view.edit") },
          { value: "preview", label: t("pageEditor.view.preview") },
        ]}
        className="lg:hidden"
      />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className={view === "edit" ? "studio-page-editor min-w-0 md:max-w-form" : "studio-page-editor hidden min-w-0 md:max-w-form lg:block"}>
          <StickyActionBar label={t("pageEditor.view.edit")} actions={<>
            <p className="min-w-0 basis-full text-meta text-text-secondary sm:flex-1 sm:basis-auto">{dirty ? t("pageEditor.unsaved") : t("pageEditor.upToDate")}</p>
            <Button variant="ghost" width="responsive" icon={<Undo2 size={18} />} disabled={!dirty} onClick={() => setDraft(state.page)}>{t("pageEditor.discard")}</Button>
            <Button width="responsive" icon={<Save size={18} />} disabled={!dirty} onClick={save}>{t("pageEditor.save")}</Button>
          </>}>
            <div className="space-y-6">
              <Block title={t("pageEditor.templates.title")}><TemplatePicker page={draft} onPick={(id) => setDraft((current) => applyTemplate(current, id))} /></Block>
              <Block title={t("pageEditor.look.title")}><ThemeControls theme={draft.theme} onChange={theme} /></Block>
              <Block title={t("pageEditor.sections.title")}>
                <SectionControls sections={visibleSections} reviewsEnabled={state.modules.reviews} instagram={draft.instagram} onChange={changeSections} onInstagram={(instagram) => change({ instagram })} />
              </Block>
              <p className="text-meta text-text-secondary">
                {t("pageEditor.cssMoved")} <Link href={`${ADVANCED_PAGE}#styling`} className="inline-flex min-h-target min-w-target items-center font-medium text-text underline">{t("nav.advanced")}</Link>
              </p>
            </div>
          </StickyActionBar>
        </div>
        <div className={view === "preview" ? "lg:sticky lg:top-4" : "hidden lg:sticky lg:top-4 lg:block"}>
          <Preview page={draft} slug={state.salon.slug} />
        </div>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Section title={title}>
      <Card className="p-4">{children}</Card>
    </Section>
  );
}
