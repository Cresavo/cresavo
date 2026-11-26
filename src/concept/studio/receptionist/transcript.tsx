import { t } from "../../i18n";
import { RECEPTIONIST_NAME, type TranscriptLine } from "../../receptionist/types";

/** What was said, in order. Plain lines: who, then the words. */
export function Transcript({ lines, live = false }: { lines: readonly TranscriptLine[]; live?: boolean }) {
  return (
    <ol className="space-y-3" role={live ? "log" : undefined} aria-live={live ? "polite" : undefined} aria-label={t("receptionist.calls.transcript")}>
      {lines.map((line, index) => (
        <li key={index} className="text-body">
          <span className="block text-meta text-text-secondary">{line.who === "caller" ? t("receptionist.calls.speaker.caller") : RECEPTIONIST_NAME}</span>
          {line.text}
        </li>
      ))}
    </ol>
  );
}

/** "1:05" for a number of seconds. */
export function clockText(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
