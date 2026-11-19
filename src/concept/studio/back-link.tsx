import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cx } from "../ui/cx";

export function BackLink({ href, label, className }: { href: string; label: string; className?: string }) {
  return (
    <Link href={href} className={cx("inline-flex min-h-target min-w-target items-center gap-1 text-meta font-medium text-text-secondary hover:text-text", className)}>
      <ChevronLeft size={16} />
      {label}
    </Link>
  );
}
