import {
  CalendarDays,
  Users,
  Scissors,
  Clock,
  Megaphone,
  LayoutDashboard,
  Leaf,
} from "lucide-react";
import AdminActions from "./ui";
import Link from "next/link";
import HeaderMenu from "./header-menu";
import { demoAccessEnabled, DEMO_ADMIN_EMAIL } from "@/lib/demo-access";
import { getLocale } from "@/lib/locale-server";
import { text } from "@/lib/locale";
export default async function AdminHeader({
  email,
  active,
}: {
  email: string;
  active:
    | "overview"
    | "calendar"
    | "services"
    | "staff"
    | "campaigns"
    | "customers";
}) {
  const locale = await getLocale();
  const t = (en: string, sv: string) => text(locale, en, sv);
  return (
    <header className="workspace-header">
      <div className="workspace-brand">
        <a href="/admin/overview">
          <Leaf className="workspace-mark" size={24} aria-hidden="true" />
          <span className="workspace-wordmark">
            Salong Eko<small>Booking Lab</small>
          </span>
        </a>
        <p>
          {demoAccessEnabled() && email === DEMO_ADMIN_EMAIL
            ? t(
                "Demo owner · private workspace",
                "Demoägare · skyddad arbetsyta",
              )
            : t(`Signed in as ${email}`, `Inloggad som ${email}`)}
        </p>
      </div>
      <nav className="workspace-primary" aria-label="Administration">
        {(
          [
            [
              "overview",
              "/admin/overview",
              t("Overview", "Översikt"),
              LayoutDashboard,
            ],
            ["calendar", "/admin", t("Calendar", "Kalender"), CalendarDays],
            ["customers", "/admin/customers", t("Customers", "Kunder"), Users],
          ] as const
        ).map(([key, href, label, Icon]) => (
          <a
            key={key}
            href={href}
            aria-current={active === key ? "page" : undefined}
          >
            <Icon
              className="ui-icon"
              size={18}
              aria-hidden="true"
              focusable="false"
            />
            {label}
          </a>
        ))}
      </nav>
      <HeaderMenu
        label={t("Business", "Salongen")}
        active={["services", "staff", "campaigns"].includes(active)}
      >
        <nav aria-label={t("Business settings", "Salongens inställningar")}>
          {(
            [
              [
                "services",
                "/admin/services",
                t("Services", "Tjänster"),
                Scissors,
              ],
              [
                "staff",
                "/admin/staff",
                t("Team & schedules", "Personal & tider"),
                Clock,
              ],
              [
                "campaigns",
                "/admin/campaigns",
                t("Campaigns", "Kampanjer"),
                Megaphone,
              ],
            ] as const
          ).map(([key, href, label, Icon]) => (
            <a
              key={key}
              href={href}
              aria-current={active === key ? "page" : undefined}
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </a>
          ))}
        </nav>
      </HeaderMenu>
      <HeaderMenu label={t("Account", "Konto")}>
        <p className="workspace-identity">
          {demoAccessEnabled() && email === DEMO_ADMIN_EMAIL
            ? t(
                "Demo owner · private workspace",
                "Demoägare · skyddad arbetsyta",
              )
            : t(`Signed in as ${email}`, `Inloggad som ${email}`)}
        </p>
        <Link prefetch={false} href="/">
          {t("Customer booking", "Visa kundbokningen")}
        </Link>
        <a href="/product">{t("About Booking Lab", "Om Booking Lab")}</a>
        <AdminActions mode="logout" />
      </HeaderMenu>
    </header>
  );
}
