"use client";

import { useState } from "react";
import { MessageCircleReply, Star } from "lucide-react";
import { addDays } from "@/concept/data/dates";
import type { Review } from "@/concept/data/types";
import { t, tc } from "@/concept/i18n";
import { formatDate, formatNumber } from "@/concept/i18n/format";
import { averageRating, findCustomer, fullName } from "@/concept/selectors";
import { dispatchWithUndoToast } from "@/concept/studio/log/undo-toast";
import { MorePage } from "@/concept/studio/more/more-page";
import { ApproveReview } from "@/concept/studio/reviews/approve-review";
import { useStudio } from "@/concept/studio/use-studio";
import { Avatar } from "@/concept/ui/avatar";
import { Button } from "@/concept/ui/button";
import { Card } from "@/concept/ui/card";
import { Meter } from "@/concept/ui/charts";
import { Chip, TextArea } from "@/concept/ui/controls";
import { Sheet } from "@/concept/ui/sheet";

const SHOWN = 20;

function draftReply(review: Review, firstName: string) {
  return review.rating >= 4 ? t("reviews.draftHappy", { name: firstName }) : t("reviews.draftUnhappy", { name: firstName });
}

export default function ReviewsPage() {
  const { state, today } = useStudio();
  const [onlyUnanswered, setOnlyUnanswered] = useState(false);
  const [replying, setReplying] = useState<Review | null>(null);
  const [text, setText] = useState("");
  const average = averageRating(state);
  const unanswered = state.reviews.filter((r) => !r.reply);
  const list = (onlyUnanswered ? unanswered : state.reviews).slice(0, SHOWN);
  const thisWeek = state.reviews.filter((r) => r.date >= addDays(today, -6)).length;

  return (
    <MorePage title={t("nav.reviews")} subtitle={tc("reviews.subtitle", state.reviews.length)} module="reviews">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="space-y-4 self-start p-5">
          <div className="flex items-end gap-3">
            <p className="text-5xl font-semibold tracking-tight">{formatNumber(average, 1)}</p>
            <p className="pb-1.5 text-warning">{"★".repeat(Math.round(average))}</p>
          </div>
          <p className="text-sm text-text-secondary">{tc("reviews.basedOn", state.reviews.length)}</p>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = state.reviews.filter((r) => r.rating === stars).length;
              return (
                <div key={stars} className="flex items-center gap-3 text-sm">
                  <span className="flex w-6 items-center gap-0.5 tabular-nums">{stars}<Star size={12} className="text-text-secondary" /></span>
                  <Meter value={state.reviews.length ? count / state.reviews.length : 0} className="flex-1" />
                  <span className="w-8 text-right tabular-nums text-text-secondary">{count}</span>
                </div>
              );
            })}
          </div>
          {thisWeek > 0 && <p className="text-xs text-text-secondary">{tc("reviews.thisWeek", thisWeek)}</p>}
        </Card>
        <div className="min-w-0 space-y-4">
          <div className="flex gap-2">
            <Chip active={!onlyUnanswered} onClick={() => setOnlyUnanswered(false)}>{t("reviews.latest")}</Chip>
            <Chip active={onlyUnanswered} count={unanswered.length} onClick={() => setOnlyUnanswered(true)}>{t("reviews.unanswered")}</Chip>
          </div>
          {list.map((r) => {
            const customer = findCustomer(state, r.customerId);
            const name = customer ? fullName(customer) : "";
            return (
              <Card key={r.id} className="space-y-3 p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{name}</p>
                    <p className="text-xs text-text-secondary">{formatDate(r.date)} · {r.source} · {state.staff.find((s) => s.id === r.staffId)?.firstName}</p>
                  </div>
                  <span role="img" className="shrink-0 text-warning" aria-label={t("inbox.stars", { count: r.rating })}>{"★".repeat(r.rating)}<span className="text-border">{"★".repeat(5 - r.rating)}</span></span>
                </div>
                <p className="text-[15px] leading-relaxed">{r.text}</p>
                <ApproveReview review={r} />
                {r.reply ? (
                  <p className="rounded-md bg-surface-2 px-3.5 py-2.5 text-sm text-text-secondary">
                    <span className="font-medium text-text">{t("reviews.yourReply")} </span>
                    {r.reply}
                  </p>
                ) : (
                  <div>
                    <Button size="sm" variant="secondary" icon={<MessageCircleReply size={16} />} onClick={() => { setReplying(r); setText(draftReply(r, customer?.firstName ?? "")); }}>
                      {t("reviews.reply")}
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
      {replying && (
        <Sheet
          open
          onClose={() => setReplying(null)}
          title={t("reviews.replyTitle")}
          description={replying.text}
          footer={
            <>
              <Button variant="ghost" onClick={() => setReplying(null)}>{t("common.cancel")}</Button>
              <Button
                disabled={!text.trim()}
                onClick={() => {
                  dispatchWithUndoToast({ type: "review/reply", id: replying.id, reply: text.trim() }, t("reviews.replied"));
                  setReplying(null);
                }}
              >
                {t("reviews.publish")}
              </Button>
            </>
          }
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-action">{t("inbox.suggestedReply")}</p>
          <TextArea value={text} onChange={(e) => setText(e.target.value)} aria-label={t("reviews.reply")} className="min-h-32" />
        </Sheet>
      )}
    </MorePage>
  );
}
