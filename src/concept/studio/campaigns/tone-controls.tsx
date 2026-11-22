import type { PosterTone } from "../../data/types";
import { NEUTRAL_TONE, TONE_RANGE, isNeutralTone } from "../../campaigns/poster-engine/tone";
import { t } from "../../i18n";
import { Button } from "../../ui/button";

const KEYS = ["light", "contrast", "warmth"] as const satisfies readonly (keyof PosterTone)[];

/** Light, contrast and warmth sliders for the poster photo; the photo file itself is never changed. */
export function ToneControls({ tone, onChange }: { tone: PosterTone; onChange: (tone: PosterTone) => void }) {
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
            value={tone[key]}
            onChange={(event) => onChange({ ...tone, [key]: Number(event.target.value) })}
            className="min-h-target min-w-0 flex-1 accent-action"
          />
          <output className="w-12 shrink-0 text-right tabular-nums text-text-secondary">{tone[key] > 0 ? "+" : ""}{tone[key]}%</output>
        </label>
      ))}
      <Button variant="secondary" size="sm" disabled={isNeutralTone(tone)} onClick={() => onChange(NEUTRAL_TONE)}>{t("campaigns.tone.reset")}</Button>
    </fieldset>
  );
}
