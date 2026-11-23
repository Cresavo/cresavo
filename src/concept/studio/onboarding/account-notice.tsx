"use client";

import { t } from "../../i18n";
import { ButtonLink } from "../../ui/button";
import { Card } from "../../ui/card";

/** In a signed-in owner's salon: where it is saved, and the way to the account. */
export function AccountNotice() {
  return (
    <Card className="mt-6 space-y-3 p-4">
      <p className="text-body text-text-secondary">{t("account.notice")}</p>
      <ButtonLink href="/account" variant="secondary">{t("account.notice.manage")}</ButtonLink>
    </Card>
  );
}
