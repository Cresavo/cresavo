"use client";

import { useState, type ReactNode } from "react";
import { Save, Undo2 } from "lucide-react";
import { t, tc } from "../../i18n";
import { MAX_CSS_LENGTH, sanitizeCss } from "../../page/css";
import { normalizePage, type PageConfig } from "../../page/config";
import type { PageTheme } from "../../page/theme";
import { dispatch, undo } from "../../store";
import { Button } from "../../ui/button";
import { Card, Section } from "../../ui/card";
import { Segmented, TextArea } from "../../ui/controls";
import { showToast } from "../../ui/toast";
import { useStudio } from "../use-studio";
import { Preview } from "./preview";
import { SectionControls } from "./section-controls";
import { ThemeControls } from "./theme-controls";

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
    if (!dispatch({ type: "page/set", page: draft })) return;
    setDraft(normalizePage(draft));
    showToast(t("pageEditor.saved"), { label: t("common.undo"), run: () => { undo(); setDraft(JSON.parse(saved) as PageConfig); } });
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
          <Block title={t("pageEditor.css.title")}><CssControls css={draft.css} onChange={(css) => change({ css })} /></Block>
          <div className="sticky bottom-[calc(8.5rem+env(safe-area-inset-bottom))] sm:bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center gap-2 rounded-lg bg-surface p-3 shadow-sheet ring-1 ring-border lg:bottom-4">
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

function CssControls({ css, onChange }: { css: string; onChange: (css: string) => void }) {
  const applied = sanitizeCss(css);
  const rules = (applied.match(/\{/g) ?? []).length;
  return (
    <div className="space-y-2">
      <p className="text-sm text-text-secondary">{t("pageEditor.css.help")}</p>
      <TextArea value={css} onChange={(event) => onChange(event.target.value)} maxLength={MAX_CSS_LENGTH} spellCheck={false} autoCapitalize="none" aria-label={t("pageEditor.css.title")} placeholder={"h1 {\n  letter-spacing: 0.02em;\n}"} className="min-h-40 font-mono text-sm" />
      <p role="status" className="text-xs text-text-secondary">
        {css.trim() ? (rules ? tc("pageEditor.css.applied", rules) : t("pageEditor.css.none")) : t("pageEditor.css.empty")}
      </p>
    </div>
  );
}
