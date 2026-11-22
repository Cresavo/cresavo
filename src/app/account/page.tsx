import { redirect } from "next/navigation";
import { SignOutButton, SignOutEverywhereButton } from "@/concept/account/account-form";
import { TwoStepSection } from "@/concept/account/two-step/section";
import { translate } from "@/concept/i18n";
import { ButtonLink } from "@/concept/ui/button";
import { Notice } from "@/concept/ui/notice";
import { enrolmentOnly } from "@/lib/owner-mfa";
import { currentOwner, ownerSalonName } from "@/lib/owner-page";
import { getLocale } from "@/lib/locale-server";

export default async function AccountPage() {
  const owner = await currentOwner();
  if (!owner) redirect("/account/login");
  const language = await getLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  // OWNER_MFA_REQUIRED=1 and no two-step sign-in yet: the session may only set it up.
  const limited = enrolmentOnly(owner);
  return (
    <div className="space-y-5">
      <h1 className="text-h1 font-semibold tracking-tight">{t("account.home.title")}</h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body">
        <dt className="text-text-secondary">{t("account.home.salon")}</dt>
        <dd className="min-w-0 break-words font-medium">{await ownerSalonName(owner.tenantId)}</dd>
        <dt className="text-text-secondary">{t("account.home.email")}</dt>
        <dd className="min-w-0 break-words">{owner.email}</dd>
      </dl>
      {limited
        ? <Notice tone="warning">{t("account.mfa.required")}</Notice>
        : <p className="text-body text-text-secondary">{t("account.home.next")}</p>}
      <div className="flex flex-wrap gap-2">
        {!limited && <ButtonLink href="/studio">{t("account.home.open")}</ButtonLink>}
        <SignOutButton language={language} />
      </div>
      <div className="border-t border-hairline pt-5">
        <TwoStepSection language={language} email={owner.email} enabled={owner.mfaEnabled} />
      </div>
      {!limited && (
        <div className="space-y-2 border-t border-hairline pt-5">
          <p className="text-meta text-text-secondary">{t("account.logoutAll.hint")}</p>
          <SignOutEverywhereButton language={language} />
        </div>
      )}
    </div>
  );
}
