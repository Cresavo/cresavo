"use client";

import { moduleEnabled } from "../modules/registry";
import { useState } from "react";
import { Search } from "lucide-react";
import { balanceOf, findGiftCard } from "../giftcards/cards";
import type { DemoState } from "../data/types";
import { t } from "../i18n";
import { formatMoney } from "../i18n/format";
import { Button } from "../ui/button";
import { Notice } from "../ui/notice";
import { Card, Section } from "../ui/card";
import { Field, TextInput } from "../ui/controls";

/** Balance check on the booking page. Anyone with the code sees the balance and nothing else about the card. */
export function GiftCardBalance({ state, compact }: { state: DemoState; compact?: boolean }) {
  const [code, setCode] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  if (!moduleEnabled(state.modules, "giftcards")) return null;
  const card = asked ? findGiftCard(state, asked) : undefined;
  const latest = state.giftCards.at(-1);

  const body = (
    <Card className="space-y-3 p-4">
      <p className="text-meta text-text-secondary">{t("giftcards.checkHelp")}</p>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setAsked(code);
        }}
      >
        <Field label={t("giftcards.checkLabel")}>
          <TextInput value={code} onChange={(event) => { setCode(event.target.value); setAsked(null); }} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder={t("giftcards.codeExample")} />
        </Field>
        <Button type="submit" variant="secondary" className="w-full" icon={<Search size={18} />} disabled={code.trim().length < 4}>
          {t("giftcards.checkButton")}
        </Button>
      </form>
      {asked !== null && (
        <div role="status" aria-live="polite">
          {card ? (
            <div className="rounded-md bg-surface-2 px-4 py-3">
              <p className="text-h3 font-semibold tabular-nums text-text">{t("giftcards.checkResult", { amount: formatMoney(balanceOf(state, card)) })}</p>
              <p className="text-meta text-text-secondary">{t("giftcards.checkOf", { amount: formatMoney(card.amount) })}</p>
            </div>
          ) : (
            <Notice tone="danger" role="alert">{t("giftcards.checkNotFound")}</Notice>
          )}
        </div>
      )}
      {latest && <p className="rounded-md bg-surface-2 px-4 py-3 text-meta text-text-secondary">{t("giftcards.checkDemo", { code: latest.code })}</p>}
    </Card>
  );
  if (!compact) return <Section title={t("giftcards.checkTitle")}>{body}</Section>;
  return (
    <details className="group">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-lg bg-surface px-4 font-medium ring-1 ring-hairline [&::-webkit-details-marker]:hidden">
        {t("giftcards.checkTitle")}
        <span aria-hidden className="text-text-secondary transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="mt-3">{body}</div>
    </details>
  );
}
