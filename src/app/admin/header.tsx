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
export default function AdminHeader({
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
            ? "Demoägare · skyddad arbetsyta"
            : `Inloggad som ${email}`}
        </p>
      </div>
      <nav className="workspace-primary" aria-label="Administration">
        {(
          [
            ["overview", "/admin/overview", "Översikt", LayoutDashboard],
            ["calendar", "/admin", "Kalender", CalendarDays],
            ["customers", "/admin/customers", "Kunder", Users],
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
        label="Salongen"
        active={["services", "staff", "campaigns"].includes(active)}
      >
        <nav aria-label="Salongens inställningar">
          {(
            [
              ["services", "/admin/services", "Tjänster", Scissors],
              ["staff", "/admin/staff", "Personal & tider", Clock],
              ["campaigns", "/admin/campaigns", "Kampanjer", Megaphone],
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
      <HeaderMenu label="Konto">
        <p className="workspace-identity">
          {demoAccessEnabled() && email === DEMO_ADMIN_EMAIL
            ? "Demoägare · skyddad arbetsyta"
            : `Inloggad som ${email}`}
        </p>
        <Link prefetch={false} href="/">
          Visa kundbokningen
        </Link>
        <a href="/product">Om Booking Lab</a>
        <AdminActions mode="logout" />
      </HeaderMenu>
    </header>
  );
}
