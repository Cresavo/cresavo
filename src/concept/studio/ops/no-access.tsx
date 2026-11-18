import { Lock } from "lucide-react";
import { t } from "../../i18n";
import { ButtonLink } from "../../ui/button";
import { EmptyState } from "../../ui/empty-state";

/** Shown instead of a page the staff view may not open. */
export function NoAccess() {
  return (
    <EmptyState
      icon={<Lock size={22} />}
      title={t("role.noAccess")}
      text={t("role.noAccessText")}
      action={<ButtonLink href="/studio" size="sm">{t("role.backToToday")}</ButtonLink>}
    />
  );
}
