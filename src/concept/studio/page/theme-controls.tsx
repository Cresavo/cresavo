"use client";

import { useRef, type ReactNode } from "react";
import { CheckCircle2, ImagePlus, Trash2 } from "lucide-react";
import { t } from "../../i18n";
import { buildTokens, contrastReport, type Palette } from "../../page/colour";
import { CORNERS, FONT_PAIR_IDS, PALETTES, PALETTE_IDS, PHOTO_IDS, type PageTheme } from "../../page/theme";
import { Button } from "../../ui/button";
import { Chip, Segmented } from "../../ui/controls";
import { showToast } from "../../ui/toast";
import { readLogo } from "./read-logo";

const FALLBACK: Palette = { background: "#f7f4ef", text: "#212522", accent: "#2f5d50" };

interface Props {
  theme: PageTheme;
  onChange: (patch: Partial<PageTheme>) => void;
}

/** Logo, colours, fonts, corners and photo. The draft changes at once; the preview frame follows. */
export function ThemeControls({ theme, onChange }: Props) {
  return (
    <div className="space-y-5">
      <LogoField theme={theme} onChange={onChange} />
      <Colours theme={theme} onChange={onChange} />
      <Group label={t("pageEditor.fonts")}>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("pageEditor.fonts")}>
          {FONT_PAIR_IDS.map((id) => (
            <Chip key={id} active={theme.fonts === id} onClick={() => onChange({ fonts: id })}>{t(`page.fonts.${id}`)}</Chip>
          ))}
        </div>
      </Group>
      <Group label={t("pageEditor.corners")}>
        <Segmented label={t("pageEditor.corners")} value={theme.corners} onChange={(corners) => onChange({ corners })} options={CORNERS.map((value) => ({ value, label: t(`page.corners.${value}`) }))} />
      </Group>
      <Group label={t("pageEditor.photo")}>
        <Segmented label={t("pageEditor.photo")} value={theme.heroPhoto} onChange={(heroPhoto) => onChange({ heroPhoto })} options={PHOTO_IDS.map((value) => ({ value, label: t(`page.photo.${value}`) }))} />
      </Group>
    </div>
  );
}

/** A labelled set of buttons. Not a `<label>`: that would rename the first button in it. */
function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      {children}
    </div>
  );
}

function LogoField({ theme, onChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    const logo = await readLogo(file);
    if (logo) onChange(logo);
    else showToast(t("pageEditor.logo.failed"));
  };
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t("pageEditor.logo")}</p>
      <div className="flex flex-wrap items-center gap-3">
        {theme.logo && (
          // A small data URL the owner just picked.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={theme.logo} alt={t("pageEditor.logo.alt")} className="h-10 w-auto max-w-40 rounded-sm bg-surface-2 object-contain p-1" />
        )}
        <Button variant="secondary" icon={<ImagePlus size={18} />} onClick={() => input.current?.click()}>{t(theme.logo ? "pageEditor.logo.change" : "pageEditor.logo.add")}</Button>
        {theme.logo && <Button variant="ghost" icon={<Trash2 size={18} />} onClick={() => onChange({ logo: null, logoColors: [] })}>{t("pageEditor.logo.remove")}</Button>}
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-label={t("pageEditor.logo.file")} onChange={(event) => { void pick(event.target.files?.[0]); event.target.value = ""; }} />
      </div>
      <p className="text-xs text-text-secondary">{t("pageEditor.logo.hint")}</p>
    </div>
  );
}

function Colours({ theme, onChange }: Props) {
  const colors = theme.colors;
  const set = (patch: Partial<Palette>) => onChange({ colors: { ...(colors ?? FALLBACK), ...patch } });
  const { tokens, adjustments } = buildTokens(colors ?? FALLBACK);
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{t("pageEditor.colours")}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("pageEditor.colours")}>
        <Chip active={!colors} onClick={() => onChange({ colors: null })}>{t("page.palette.default")}</Chip>
        {PALETTE_IDS.map((id) => (
          <Chip key={id} active={colors?.background === PALETTES[id].background && colors.accent === PALETTES[id].accent} onClick={() => onChange({ colors: PALETTES[id] })}>
            <span aria-hidden className="size-3.5 rounded-full ring-1 ring-border" style={{ background: PALETTES[id].accent }} />
            {t(`page.palette.${id}`)}
          </Chip>
        ))}
      </div>
      {theme.logoColors.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-text-secondary">{t("pageEditor.logoColours")}</span>
          {theme.logoColors.map((accent) => (
            <Chip key={accent} active={colors?.accent === accent} onClick={() => set({ accent })}>
              <span aria-hidden className="size-3.5 rounded-full ring-1 ring-border" style={{ background: accent }} />
              {accent}
            </Chip>
          ))}
        </div>
      )}
      {colors && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {(["background", "text", "accent"] as const).map((role) => (
              <label key={role} className="space-y-1.5 text-sm font-medium">
                <span className="block">{t(`pageEditor.colour.${role}`)}</span>
                <input type="color" value={colors[role]} onChange={(event) => set({ [role]: event.target.value })} className="block h-11 w-full cursor-pointer rounded-md bg-surface p-1 ring-1 ring-inset ring-border" />
              </label>
            ))}
          </div>
          <div role="status" className="space-y-2 rounded-md bg-surface-2/60 p-3 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <CheckCircle2 size={16} className="text-action" />
              {t("pageEditor.contrast.ok")}
            </p>
            <p className="text-xs text-text-secondary">
              {contrastReport(tokens).map((row) => `${t(`pageEditor.contrast.${row.label}`)} ${row.ratio.toFixed(1)}:1`).join(" · ")}
            </p>
            {adjustments.map((adjustment) => (
              <p key={adjustment.role} className="text-xs">{t("pageEditor.contrast.adjusted", { role: t(`pageEditor.colour.${adjustment.role}`).toLowerCase(), from: adjustment.from, to: adjustment.to })}</p>
            ))}
            {adjustments.length > 0 && (
              <Button size="sm" variant="secondary" onClick={() => set(Object.fromEntries(adjustments.map((a) => [a.role, a.to])))}>{t("pageEditor.contrast.apply")}</Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
