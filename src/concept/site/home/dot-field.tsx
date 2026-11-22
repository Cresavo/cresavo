import { useEffect, useRef, useState, type ReactNode } from "react";
import { createDotField, type DotField as Field, type DotOptions } from "./dot-engine";
import h from "./home.module.css";

/**
 * A canvas that draws a shape in dots inside `className`'s box. The host keeps
 * its CSS size; the engine pads the canvas around it. `children` is the
 * fallback, shown without JavaScript or when the canvas cannot be drawn.
 * The dot colours come from the canvas's own CSS (color, top and bottom
 * border colours), so they follow the theme; `theme` re-tints on a change.
 */
export function DotField({ className, shape, label, theme, children }: {
  className: string;
  shape: (host: HTMLElement) => Omit<DotOptions, "palette">;
  label?: string;
  theme: string;
  children?: ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const field = useRef<Field | null>(null);
  const [ready, setReady] = useState(false);
  const make = useRef(shape);

  useEffect(() => {
    const box = host.current, cv = canvas.current;
    if (!box || !cv) return;
    const style = getComputedStyle(cv);
    const f = createDotField(cv, box, { ...make.current(box), palette: () => [style.color, style.borderTopColor, style.borderBottomColor] });
    field.current = f;
    setReady(f !== null);
    return () => { f?.destroy(); field.current = null; };
  }, []);

  useEffect(() => { field.current?.retint(); }, [theme]);

  return (
    <div ref={host} className={`${className} ${h.dotHost}`} data-ready={ready ? "" : undefined}>
      <canvas ref={canvas} className={h.dotCanvas} {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })} />
      {children}
    </div>
  );
}
