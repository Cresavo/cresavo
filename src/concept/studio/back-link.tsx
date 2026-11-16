import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cx } from "../ui/cx";

export function BackLink({ href, label, className }: { href: string; label: string; className?: string }) {
  return (
    <Link href={href} className={cx("inline-flex items-center gap-1 text-sm font-medium text-eko-muted hover:text-eko-ink", className)}>
      <ChevronLeft size={16} />
      {label}
    </Link>
  );
}
