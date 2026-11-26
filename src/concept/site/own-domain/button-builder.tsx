import { useId, useState, type CSSProperties } from "react";
import { bookingShare } from "../../booking/share";
import { useSiteCopy } from "../copy";
import { BUTTON_COLOUR_IDS, BUTTON_COLOURS, DEMO_SALON, DEMO_SLUG, MAX_LABEL, buttonSnippet, buttonStyle, type ButtonColour } from "./snippets";
import o from "./own-domain.module.css";

type CopyState = "idle" | "copied" | "failed";

/** A code sample with a copy action. The code stays selectable, so a blocked clipboard still leaves a way to copy it. */
export function CopyCode({ label, code }: { label: string; code: string }) {
  const { site } = useSiteCopy();
  const [state, setState] = useState<CopyState>("idle");
  const id = useId();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setState("copied");
    } catch {
      setState("failed");
    }
  };
  return (
    <div className={o.code}>
      <div className={o.codeHead}>
        <span id={id}>{label}</span>
        <button type="button" className={o.copy} onClick={copy} aria-describedby={id}>{site["domain.copy"]}</button>
      </div>
      <pre aria-labelledby={id} tabIndex={0}><code>{code}</code></pre>
      <p className={o.copyState} role="status">{state === "copied" ? site["domain.copied"] : state === "failed" ? site["domain.copyFailed"] : ""}</p>
    </div>
  );
}

/** Pick a colour and a label; the preview is the real button, pointing at the demo salon's booking widget. */
export function ButtonBuilder({ origin }: { origin: string }) {
  const { site } = useSiteCopy();
  const [colour, setColour] = useState<ButtonColour>("forest");
  const [label, setLabel] = useState("");
  const fallback = site["domain.button.default"];
  const text = label.trim() || fallback;
  const { widget } = bookingShare(origin, DEMO_SLUG, DEMO_SALON);
  return (
    <div className={o.builder}>
      <div className={o.preview} aria-label={site["domain.button.preview"]} role="group">
        <a href={widget} target="_blank" rel="noopener" style={buttonStyle(colour)}>{text}</a>
      </div>
      <label className={o.field}>
        <span>{site["domain.button.label"]}</span>
        <input type="text" value={label} placeholder={fallback} maxLength={MAX_LABEL} onChange={(event) => setLabel(event.currentTarget.value)} />
      </label>
      <fieldset className={o.swatches}>
        <legend>{site["domain.button.colour"]}</legend>
        <div>
          {BUTTON_COLOUR_IDS.map((id) => (
            <label key={id} className={o.swatch} style={{ "--swatch": BUTTON_COLOURS[id] } as CSSProperties}>
              <input type="radio" name="button-colour" value={id} checked={colour === id} onChange={() => setColour(id)} />
              <span className={o.srOnly}>{site[`domain.colour.${id}`]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <CopyCode label={site["domain.button.code"]} code={buttonSnippet(origin, colour, label, fallback)} />
    </div>
  );
}
