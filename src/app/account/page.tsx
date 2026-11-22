import { redirect } from "next/navigation";
import { SignOutButton, SignOutEverywhereButton } from "@/concept/account/account-form";
import { translate } from "@/concept/i18n";
import { ButtonLink } from "@/concept/ui/button";
import { currentOwner, ownerSalonName } from "@/lib/owner-page";
import { getLocale } from "@/lib/locale-server";

export default async function AccountPage() {
  const owner = await currentOwner();
  if (!owner) redirect("/account/login");
  const language = await getLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  return (
    <div className="space-y-5">
      <h1 className="text-h1 font-semibold tracking-tight">{t("account.home.title")}</h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body">
        <dt className="text-text-secondary">{t("account.home.salon")}</dt>
        <dd className="min-w-0 break-words font-medium">{await ownerSalonName(owner.tenantId)}</dd>
        <dt className="text-text-secondary">{t("account.home.email")}</dt>
        <dd className="min-w-0 break-words">{owner.email}</dd>
      </dl>
      <p className="text-body text-text-secondary">{t("account.home.next")}</p>
      <div className="flex flex-wrap gap-2">
        <ButtonLink href="/studio">{t("account.home.open")}</ButtonLink>
        <SignOutButton language={language} />
      </div>
      <div className="space-y-2">
        <p className="text-meta text-text-secondary">{t("account.logoutAll.hint")}</p>
        <SignOutEverywhereButton language={language} />
      </div>
    </div>
  );
}
