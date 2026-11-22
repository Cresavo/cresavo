import type { ReactNode } from "react";
import { Bookmark, Heart, MessageCircle, Send } from "lucide-react";

const ICONS = [Heart, MessageCircle, Send];

/** The poster at feed width inside a plain, neutral phone-feed mock: who posted, the picture and a row of icons. */
export function FeedPreview({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full overflow-hidden rounded-lg bg-surface ring-1 ring-input-border" style={{ maxWidth: 360 }}>
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold text-text-secondary">
          {name.trim().charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 truncate text-sm font-semibold">{name}</span>
      </div>
      {children}
      <div aria-hidden className="flex items-center gap-4 px-3 py-2.5 text-text">
        {ICONS.map((Icon, index) => <Icon key={index} size={22} strokeWidth={1.75} />)}
        <Bookmark size={22} strokeWidth={1.75} className="ml-auto" />
      </div>
    </div>
  );
}
