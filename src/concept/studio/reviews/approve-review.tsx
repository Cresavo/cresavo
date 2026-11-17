import type { Review } from "../../data/types";
import { t } from "../../i18n";
import { dispatch, undo } from "../../store";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { showToast } from "../../ui/toast";

export function ApproveReview({ review }: { review: Review }) {
  if (review.approved !== false) return null;
  return <div className="flex flex-wrap items-center gap-3">
    <Badge tone="warn">{t("customerReview.awaiting")}</Badge>
    <Button size="sm" onClick={() => {
      if (dispatch({ type: "review/approve", id: review.id })) showToast(t("customerReview.published"), { label: t("common.undo"), run: undo });
    }}>{t("customerReview.approve")}</Button>
  </div>;
}
