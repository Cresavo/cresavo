import { redirect } from "next/navigation";
import { AccountForm } from "@/concept/account/account-form";
import { currentOwner } from "@/lib/owner-page";
import { getLocale } from "@/lib/locale-server";

export default async function SignupPage() {
  if (await currentOwner()) redirect("/account");
  return <AccountForm mode="signup" language={await getLocale()} />;
}
