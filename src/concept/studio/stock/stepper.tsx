import { Minus, Plus } from "lucide-react";
import { IconButton } from "../../ui/button";

/** Small minus / number / plus control for whole amounts. */
export function Stepper({ value, onChange, min = 0, lessLabel, moreLabel }: { value: number; onChange: (value: number) => void; min?: number; lessLabel: string; moreLabel: string }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <IconButton label={lessLabel} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} className="size-10 ring-1 ring-hairline">
        <Minus size={16} />
      </IconButton>
      <span className="w-9 text-center font-semibold tabular-nums">{value}</span>
      <IconButton label={moreLabel} onClick={() => onChange(value + 1)} className="size-10 ring-1 ring-hairline">
        <Plus size={16} />
      </IconButton>
    </div>
  );
}
