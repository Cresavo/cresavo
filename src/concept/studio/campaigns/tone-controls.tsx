import { useState } from "react";
import type { PosterTone } from "../../data/types";
import { NEUTRAL_TONE, TONE_RANGE, isNeutralTone } from "../../campaigns/poster-engine/tone";
import { t } from "../../i18n";
import { Button } from "../../ui/button";

const KEYS = ["light", "contrast", "warmth"] as const satisfies readonly (keyof PosterTone)[];

const signed = (value: number) => `${value > 0 ? "+" : ""}${t("format.percent", { value })}`;

/**
 * Light, contrast and warmth sliders for the poster photo; the photo file itself is never changed. A drag
 * moves the sliders only; the poster is redrawn when the slider is let go, so a long drag costs one render.
 */
export function ToneControls({ tone, onChange }: { tone: PosterTone; onChange: (tone: PosterTone) => void }) {
  const [draft, setDraft] = useState(tone);
  // A new tone from outside (reset, another campaign) replaces the slider positions.
  const [shown, setShown] = useState(tone);
  if (shown !== tone) {
    setShown(tone);
    setDraft(tone);
  }
  const commit = () => {
    if (KEYS.some((key) => draft[key] !== tone[key])) onChange(draft);
  };
  return (
    <fieldset className="space-y-3">
      <legend className="block text-sm font-medium">{t("campaigns.tone.title")}</legend>
      {KEYS.map((key) => (
        <label key={key} className="flex items-center gap-3 text-sm">
          <span className="w-20 shrink-0">{t(`campaigns.tone.${key}`)}</span>
          <input
            type="range"
            min={-TONE_RANGE[key]}
            max={TONE_RANGE[key]}
            step={1}
            value={draft[key]}
            aria-valuetext={signed(draft[key])}
            onChange={(event) => setDraft({ ...draft, [key]: Number(event.target.value) })}
            onPointerUp={commit}
            onKeyUp={commit}
            onBlur={commit}
            className="min-h-target min-w-0 flex-1 accent-action"
          />
          <span aria-hidden className="w-14 shrink-0 text-right tabular-nums text-text-secondary">{signed(draft[key])}</span>
        </label>
      ))}
      <Button variant="secondary" size="sm" disabled={isNeutralTone(tone) && isNeutralTone(draft)} onClick={() => onChange(NEUTRAL_TONE)}>{t("campaigns.tone.reset")}</Button>
    </fieldset>
  );
}
