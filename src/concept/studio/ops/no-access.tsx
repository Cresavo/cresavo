import { t } from "../../i18n";
import { ButtonLink } from "../../ui/button";
import { PageHeader } from "../page-header";

/** Shown instead of a page the staff view may not open. */
export function NoAccess() {
  return (
    <PageHeader tools={false} title={t("role.noAccess")} subtitle={t("role.noAccessText")}
      actions={<ButtonLink href="/studio" size="sm">{t("role.backToToday")}</ButtonLink>} />
  );
}
