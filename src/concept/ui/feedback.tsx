import { useId, type ReactNode } from "react";
import { t } from "../i18n";
import { cx } from "./cx";

export function Skeleton({ className }: { className?: string }) {
  return <span role="status" className={cx("ui-skeleton block min-h-target rounded-md bg-surface-2", className)}>
    <span className="sr-only">{t("ui.loading")}</span>
  </span>;
}

/** One quiet block of a loading silhouette. Decorative: the surrounding SkeletonGroup names the wait. */
export function Bone({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cx("ui-skeleton block rounded-sm bg-surface-2", className)} />;
}

/** A loading silhouette in the shape of what is coming, announced once as loading. */
export function SkeletonGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div role="status" aria-busy="true" className={className}>
    <span className="sr-only">{t("ui.loading")}</span>
    {children}
  </div>;
}

/** A ListRow while it loads: a round mark and two lines. */
export function SkeletonRow({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx("flex min-h-14 items-center gap-3 px-4 py-2", className)}>
    <Bone className="size-9 shrink-0 rounded-full" />
    <span className="min-w-0 flex-1 space-y-2">
      <Bone className="h-3 w-2/5" />
      <Bone className="h-3 w-3/5" />
    </span>
  </div>;
}

/** A few lines of running text; the last one is shorter, like a paragraph. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return <div aria-hidden="true" className={cx("space-y-2", className)}>
    {Array.from({ length: lines }, (_, line) => <Bone key={line} className={cx("h-3", line === lines - 1 && lines > 1 ? "w-3/5" : "w-full")} />)}
  </div>;
}

/** A compact card: a title and a few lines on one paper surface. */
export function SkeletonCard({ lines = 2, className }: { lines?: number; className?: string }) {
  return <div aria-hidden="true" className={cx("space-y-4 rounded-lg bg-surface p-5", className)}>
    <Bone className="h-4 w-1/3" />
    <SkeletonText lines={lines} />
  </div>;
}

const COLUMN_BLOCKS = ["h-16", "h-24", "h-12"];

/** One calendar column: the staff name above and a few bookings down the day. */
export function SkeletonColumn({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx("min-w-0 flex-1 space-y-3", className)}>
    <Bone className="h-4 w-1/2" />
    {COLUMN_BLOCKS.map((height, block) => <Bone key={block} className={cx(height, "w-full rounded-md", block === 1 && "mt-8")} />)}
  </div>;
}

/**
 * A quiet sign of a wait beside a sentence that already says what is happening, in the text's own colour.
 * `progress` fills a small ring (something is being done: a payment, a save); `wait` is a slow dot (waiting on
 * someone or something else). With reduced motion both hold still.
 */
export function StatusDot({ kind = "wait", className }: { kind?: "wait" | "progress"; className?: string }) {
  return <span aria-hidden="true" className={cx(kind === "progress" ? "ui-fill" : "ui-dot", className)} />;
}

export function SuccessCheck() {
  const id = useId();
  return (
    <svg role="img" aria-label={t("ui.success")} viewBox="0 0 24 24" width="24" height="24" className="text-success">
      <defs><clipPath id={id}><rect className="ui-check" width="24" height="24" /></clipPath></defs>
      <g clipPath={`url(#${id})`}>
        <path d="m4 12 5 5L20 6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
