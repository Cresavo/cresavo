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

/** The card as it is shared and printed, in the surrounding theme's action colours. */
export function GiftCardFace({ salonName, amount, recipient, message, code }: CardFaceProps) {
  return (
    <div className="flex min-h-48 w-full flex-col justify-between gap-4 rounded-lg bg-action p-5 text-on-action print:[print-color-adjust:exact] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 break-words text-meta font-medium">
          <Gift size={16} aria-hidden />
          <span className="min-w-0">{salonName}</span>
        </p>
        <p className="text-h1 font-semibold tabular-nums tracking-tight">{formatMoney(amount)}</p>
      </div>
      <div className="min-w-0 space-y-1">
        <p className="break-words text-meta">{t("giftcards.for", { name: recipient })}</p>
        {message && <p className="line-clamp-2 break-words text-body">{message}</p>}
      </div>
      <div>
        <p className="text-meta uppercase tracking-wider">{t("giftcards.code")}</p>
        <p className="break-words font-mono text-h2 font-semibold tracking-wider">{code}</p>
      </div>
    </div>
  );
}
