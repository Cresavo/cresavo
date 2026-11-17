import { Gift } from "lucide-react";
import { t } from "../i18n";
import { formatMoney } from "../i18n/format";

interface CardFaceProps {
  salonName: string;
  amount: number;
  recipient: string;
  message: string;
  code: string;
}

/** The card as it is shared and printed. Colours are fixed so it looks the same on screen and on paper. */
export function GiftCardFace({ salonName, amount, recipient, message, code }: CardFaceProps) {
  return (
    <div
      className="relative aspect-[1.7/1] w-full overflow-hidden rounded-3xl p-5 text-white shadow-card sm:p-6"
      style={{ background: "linear-gradient(135deg, #2f5d50 0%, #1c3a31 100%)" }}
    >
      <div className="pointer-events-none absolute -right-10 -top-12 size-44 rounded-full bg-white/10" aria-hidden />
      <div className="pointer-events-none absolute -bottom-16 -left-8 size-40 rounded-full bg-white/5" aria-hidden />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-medium opacity-90">
            <Gift size={16} aria-hidden />
            {salonName}
          </p>
          <p className="text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">{formatMoney(amount)}</p>
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm opacity-80">{t("giftcards.for", { name: recipient })}</p>
          {message && <p className="line-clamp-2 text-[15px] leading-snug">{message}</p>}
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] opacity-70">{t("giftcards.code")}</p>
          <p className="font-mono text-lg font-semibold tracking-wider sm:text-xl">{code}</p>
        </div>
      </div>
    </div>
  );
}
