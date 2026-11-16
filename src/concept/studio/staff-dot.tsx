import type { StaffId } from "../data/types";
import { cx } from "../ui/cx";

/** Small colour marker for Anna (green) or Erik (clay). */
export function StaffDot({ staffId, className }: { staffId: StaffId; className?: string }) {
  return <span aria-hidden className={cx("inline-block size-2 shrink-0 rounded-full", staffId === "anna" ? "bg-eko-anna" : "bg-eko-erik", className)} />;
}
