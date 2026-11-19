"use client";

import { useState } from "react";
import { Compass, RotateCcw } from "lucide-react";
import { parseLocale } from "@/lib/locale";
import { t, tc, term } from "../../i18n";
import { setupOf } from "../../onboarding/setup";
import { MAX_CSS_LENGTH, sanitizeCss } from "../../page/css";
import { PACKS, type Pack } from "../../packs";
import { dispatch, startBusiness } from "../../store";
import { Badge } from "../../ui/badge";
import { Button, ButtonLink } from "../../ui/button";
import { Card, Section } from "../../ui/card";
import { Field, Select, Switch, TextArea } from "../../ui/controls";
import { Sheet } from "../../ui/sheet";
import { showToast } from "../../ui/toast";
import { usePairing } from "../pairing/session";
import { dispatchWithUndoToast } from "../log/undo-toast";
import { useStudio } from "../use-studio";

/** The language the booking page and customer messages use, and whether visitors may switch. */
export function BookingLanguageSection() {
  const { state } = useStudio();
  const { localization } = state;
  return (
    <Section title={t("language.businessTitle")}>
      <Card className="space-y-4 p-4">
        <p className="text-sm text-text-secondary">{t("language.businessHint")}</p>
        <Field width="short" label={t("language.businessDefault")}>
          <Select
            value={localization.language}
            onChange={(event) => {
              const language = parseLocale(event.currentTarget.value);
              if (language) dispatch({ type: "salon/language", language, bilingual: localization.bilingual });
            }}
          >
            <option value="sv" lang="sv">{t("language.sv")}</option>
            <option value="en" lang="en">{t("language.en")}</option>
          </Select>
        </Field>
        <div className="flex items-center justify-between gap-3">
          <span className="text-body">{t("language.allowBoth")}</span>
          <Switch
            checked={localization.bilingual}
            label={t("language.allowBoth")}
            onChange={() => dispatch({ type: "salon/language", language: localization.language, bilingual: !localization.bilingual })}
          />
        </div>
      </Card>
    </Section>
  );
}

/** Own CSS for the booking page, for details the editor's theme does not cover. Saved like any page change, with Undo. */
export function CustomStylingSection() {
  const { state } = useStudio();
  const [css, setCss] = useState(state.page.css);
  const applied = sanitizeCss(css);
  const rules = (applied.match(/\{/g) ?? []).length;
  const dirty = css !== state.page.css;
  return (
    <Section title={t("pageEditor.css.title")}>
      <Card className="space-y-3 p-4">
        <p className="text-sm text-text-secondary">{t("pageEditor.css.help")}</p>
        <TextArea value={css} onChange={(event) => setCss(event.target.value)} maxLength={MAX_CSS_LENGTH} spellCheck={false} autoCapitalize="none" aria-label={t("pageEditor.css.title")} placeholder={t("pageEditor.cssExample")} className="min-h-40 font-mono text-base" />
        <p role="status" className="text-xs text-text-secondary">
          {css.trim() ? (rules ? tc("pageEditor.css.applied", rules) : t("pageEditor.css.none")) : t("pageEditor.css.empty")}
        </p>
        <Button variant="secondary" width="responsive" disabled={!dirty} onClick={() => {
          if (!dispatchWithUndoToast({ type: "page/set", page: { ...state.page, css } }, t("pageEditor.saved"))) setCss(state.page.css);
        }}>
          {t("pageEditor.css.save")}
        </Button>
      </Card>
    </Section>
  );
}

/** Switching the industry pack rebuilds the demo for another kind of business. */
export function PackSection() {
  const { state } = useStudio();
  const [switching, setSwitching] = useState<Pack | null>(null);
  const packName = (pack: Pack) => t(`pack.${pack.id}.name`);
  const switchPack = async (pack: Pack) => {
    setSwitching(null);
    await startBusiness({ ...setupOf(state), pack: pack.id, modules: undefined });
    showToast(t("features.pack.switched", { pack: packName(pack) }));
  };
  return (
    <Section title={t("features.pack.title")}>
      <p className="text-sm text-text-secondary">{t("features.pack.text")}</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {PACKS.map((pack) => {
          const current = pack.id === state.pack;
          return (
            <Card key={pack.id} className="flex flex-col gap-3 p-4">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-medium">{packName(pack)}</p>
                <p className="text-sm text-text-secondary">{t(`pack.${pack.id}.description`)}</p>
                <p className="text-xs text-text-secondary">{t("features.pack.words", { customers: term("customer", { plural: true, vocabulary: pack.vocabulary }), services: term("service", { plural: true, vocabulary: pack.vocabulary }) })}</p>
              </div>
              {current ? <Badge tone="accent" className="self-start">{t("features.pack.current")}</Badge> : <Button variant="secondary" size="sm" className="self-start" onClick={() => setSwitching(pack)}>{t("features.pack.use")}</Button>}
            </Card>
          );
        })}
      </div>
      {switching && (
        <Sheet
          open
          onClose={() => setSwitching(null)}
          title={t("features.pack.switchTitle", { pack: packName(switching) })}
          footer={
            <>
              <Button variant="ghost" onClick={() => setSwitching(null)}>{t("features.pack.cancel")}</Button>
              <Button onClick={() => switchPack(switching)}>{t("features.pack.use")}</Button>
            </>
          }
        >
          <p className="text-body">{t("features.pack.switchText", { pack: packName(switching) })}</p>
        </Sheet>
      )}
    </Section>
  );
}

/** The demo salon only: start over as a new business, or reset the demo data. */
export function DemoSection() {
  const pairing = usePairing();
  const { state } = useStudio();
  const [confirming, setConfirming] = useState(false);
  if (state.industry) return null;
  return (
    <Section title={t("settings.demo")} className="space-y-3">
      <Card className="flex flex-wrap items-center gap-4 p-4">
        <p className="min-w-0 flex-1 text-sm text-text-secondary">{t("settings.startOverText")}</p>
        <ButtonLink href="/studio/welcome" variant="secondary" icon={<Compass size={18} />}>{t("settings.startOver")}</ButtonLink>
      </Card>
      <Card className="flex flex-wrap items-center gap-4 p-4">
        <p className="min-w-0 flex-1 text-sm text-text-secondary">{t("settings.demoText")}</p>
        <Button variant="danger" icon={<RotateCcw size={18} />} onClick={() => setConfirming(true)}>{t("settings.reset")}</Button>
      </Card>
      {confirming && (
        <Sheet
          open
          onClose={() => setConfirming(false)}
          title={t("settings.resetTitle")}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirming(false)}>{t("common.cancel")}</Button>
              <Button
                variant="danger"
                onClick={async () => {
                  if (pairing?.workspace && !await pairing.command("session", { action: "disconnect", workspaceId: pairing.workspace.id })) return;
                  setConfirming(false);
                  await startBusiness(setupOf(state));
                  showToast(t("settings.resetDone"));
                }}
              >
                {t("settings.reset")}
              </Button>
            </>
          }
        >
          <p className="text-body">{t("settings.resetText")}</p>
        </Sheet>
      )}
    </Section>
  );
}
