import { Compass } from "lucide-react";
import { t } from "../i18n";
import { Card } from "../ui/card";
import "./tenant-theme.css";

/** Shown when an address does not lead to a booking page: a mistyped slug or a domain that is not connected. */
export function UnknownAddress({ host }: { host?: string }) {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-lg items-center px-4 py-10">
      <Card className="w-full space-y-4 p-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-action-bg text-action">
          <Compass size={22} />
        </span>
        <h1 className="text-xl font-semibold tracking-tight">{t("address.unknown.title")}</h1>
        <p className="text-[15px] text-text-secondary">{host ? t("address.unknown.host", { host }) : t("address.unknown.text")}</p>
        <p className="text-sm text-text-secondary">{t("address.unknown.help")}</p>
      </Card>
    </main>
  );
}
