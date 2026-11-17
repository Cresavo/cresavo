import type { ReactNode } from "react";
import { Globe, Heart, Leaf, MessageCircle, Music2, Send, ThumbsUp, Share2 } from "lucide-react";
import type { Channel } from "../../data/types";
import { t } from "../../i18n";

// Rough look-alikes of how a post appears in each channel. Only the layout
// matters here; nothing is sent anywhere.

interface PreviewProps {
  channel: Channel;
  text: string;
  /** Subject line of the newsletter. */
  subject: string;
  salonName: string;
  /** Poster in the format the channel shows: a post, or a story for TikTok. */
  post: ReactNode;
  story: ReactNode;
}

function Avatar({ size = 32 }: { size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-action text-on-action" style={{ width: size, height: size }}>
      <Leaf size={size * 0.5} />
    </span>
  );
}

const frame = "mx-auto w-full max-w-sm overflow-hidden rounded-lg bg-surface text-[13px] leading-snug ring-1 ring-border";

export function ChannelPreview({ channel, text, subject, salonName, post, story }: PreviewProps) {
  const handle = salonName.toLowerCase().replace(/\s+/g, "_");
  switch (channel) {
    case "instagram":
      return (
        <div className={frame}>
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <Avatar />
            <span className="font-semibold">{handle}</span>
          </div>
          {post}
          <div className="flex gap-3 px-3 pt-2.5 text-text">
            <Heart size={20} />
            <MessageCircle size={20} />
            <Send size={20} />
          </div>
          <p className="whitespace-pre-line px-3 pb-3 pt-2">
            <span className="font-semibold">{handle}</span> {text}
          </p>
        </div>
      );
    case "facebook":
      return (
        <div className={frame}>
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <Avatar size={36} />
            <span>
              <span className="block font-semibold">{salonName}</span>
              <span className="flex items-center gap-1 text-xs text-text-secondary">
                {t("campaigns.preview.justNow")} · <Globe size={11} />
              </span>
            </span>
          </div>
          <p className="whitespace-pre-line px-3 pb-2.5">{text}</p>
          {post}
          <div className="flex justify-around border-t border-border py-2 text-xs font-medium text-text-secondary">
            <span className="flex items-center gap-1.5"><ThumbsUp size={14} />{t("campaigns.preview.like")}</span>
            <span className="flex items-center gap-1.5"><MessageCircle size={14} />{t("campaigns.preview.comment")}</span>
            <span className="flex items-center gap-1.5"><Share2 size={14} />{t("campaigns.preview.share")}</span>
          </div>
        </div>
      );
    case "tiktok":
      return (
        <div className="relative mx-auto w-52 overflow-hidden rounded-lg bg-black ring-1 ring-border">
          {story}
          <div className="absolute inset-x-0 bottom-0 space-y-1 bg-gradient-to-t from-black/85 to-transparent px-3 pb-3 pt-10 text-[11px] leading-snug text-white">
            <p className="font-semibold">@{handle}</p>
            <p className="line-clamp-4 whitespace-pre-line">{text}</p>
            <p className="flex items-center gap-1 text-white/80"><Music2 size={11} />{t("campaigns.preview.sound")}</p>
          </div>
        </div>
      );
    case "newsletter":
      return (
        <div className={frame}>
          <div className="space-y-0.5 border-b border-border px-3 py-2.5">
            <p className="font-semibold">{subject}</p>
            <p className="text-xs text-text-secondary">{t("campaigns.preview.from", { name: salonName })}</p>
          </div>
          {post}
          <p className="whitespace-pre-line px-3.5 py-3">{text}</p>
          <p className="px-3.5 pb-4">
            <span className="inline-block rounded-md bg-action px-4 py-2 text-sm font-medium text-on-action">{t("campaigns.preview.bookButton")}</span>
          </p>
        </div>
      );
    case "sms":
      return (
        <div className="mx-auto w-full max-w-xs space-y-1.5 rounded-lg bg-surface-2 p-3">
          <p className="text-center text-xs text-text-secondary">{salonName}</p>
          <p className="whitespace-pre-line rounded-lg rounded-tl-sm bg-surface px-3.5 py-2.5 text-[14px] leading-snug">{text}</p>
        </div>
      );
  }
}
