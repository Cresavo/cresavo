import "./style.css";
import "./workspace-polish.css";
import { RestoreReturnScroll } from "./components/context-link";
import { LocaleProvider, LanguageSwitch } from "./components/locale-provider";
import { getLocale } from "@/lib/locale-server";
import { text } from "@/lib/locale";
export async function generateMetadata() {
  const locale = await getLocale();
  return {
    title: text(locale, "Salong Eko — Booking Lab demo", "Salong Eko – boka tid"),
    description: text(locale, "Book a treatment at our fictional demo business.", "Boka en behandling hos vår demosalong."),
  };
}
export default async function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <LocaleProvider locale={locale}>
          <RestoreReturnScroll />
          <div className="demo-banner">
            <span>
              {text(
                locale,
                "Demo — fictional data only",
                "Demo – endast påhittade uppgifter",
              )}
            </span>
            <LanguageSwitch />
          </div>
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
