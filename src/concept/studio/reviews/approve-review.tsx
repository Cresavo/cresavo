import type { Review } from "../../data/types";
import { t } from "../../i18n";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { dispatchWithUndoToast } from "../log/undo-toast";

export function ApproveReview({ review }: { review: Review }) {
  if (review.approved !== false) return null;
  return <div className="flex flex-wrap items-center gap-3">
    <Badge tone="warn">{t("customerReview.awaiting")}</Badge>
    <Button variant="secondary" size="sm" onClick={() => {
      dispatchWithUndoToast({ type: "review/approve", id: review.id }, t("customerReview.published"));
    }}>{t("customerReview.approve")}</Button>
  </div>;
}
