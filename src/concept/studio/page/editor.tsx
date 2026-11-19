"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Save, Undo2 } from "lucide-react";
import { t } from "../../i18n";
import { normalizePage, type PageConfig } from "../../page/config";
import type { PageTheme } from "../../page/theme";
import { dispatchWithLog } from "../../store";
import { Button } from "../../ui/button";
import { Card, Section } from "../../ui/card";
import { Segmented } from "../../ui/controls";
import { ADVANCED_PAGE } from "../nav";
import { useStudio } from "../use-studio";
import { Preview } from "./preview";
import { SectionControls } from "./section-controls";
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
        className="w-full lg:hidden"
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className={view === "edit" ? "space-y-6" : "hidden space-y-6 lg:block"}>
          <Block title={t("pageEditor.look.title")}><ThemeControls theme={draft.theme} onChange={theme} /></Block>
          <Block title={t("pageEditor.sections.title")}>
            <SectionControls sections={draft.sections} instagram={draft.instagram} onChange={(sections) => change({ sections })} onInstagram={(instagram) => change({ instagram })} />
          </Block>
          <p className="text-meta text-text-secondary">{t("pageEditor.cssMoved")} <Link href={`${ADVANCED_PAGE}#styling`} className="font-medium text-text underline">{t("nav.advanced")}</Link></p>
          <div className="sticky bottom-[calc(8.5rem+env(safe-area-inset-bottom))] sm:bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center gap-2 rounded-lg bg-surface p-3 shadow-sheet ring-1 ring-hairline lg:bottom-4">
            <p className="min-w-0 basis-full text-sm text-text-secondary sm:flex-1 sm:basis-auto">{dirty ? t("pageEditor.unsaved") : t("pageEditor.upToDate")}</p>
            <Button variant="ghost" icon={<Undo2 size={18} />} disabled={!dirty} onClick={() => setDraft(state.page)}>{t("pageEditor.discard")}</Button>
            <Button icon={<Save size={18} />} disabled={!dirty} onClick={save}>{t("pageEditor.save")}</Button>
          </div>
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
