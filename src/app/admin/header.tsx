import Link from "next/link";
import { CalendarDays, Users, Scissors, Clock, Megaphone } from "lucide-react";
import AdminActions from "./ui";
import { demoAccessEnabled, DEMO_ADMIN_EMAIL } from "@/lib/demo-access";
export default function AdminHeader({
  email,
  active,
}: {
  email: string;
  active:
    "overview" | "calendar" | "services" | "staff" | "campaigns" | "customers";
}) {
  return (
    <header className="admin-header">
      <div className="admin-brand">
        <a href="/admin">
          SALONG EKO <span>/ DEMO</span>
        </a>
        <p>
          {demoAccessEnabled() && email === DEMO_ADMIN_EMAIL
            ? "Demoägare · skyddad arbetsyta"
            : `Inloggad som ${email}`}
        </p>
      </div>
      <nav aria-label="Administration">
        {(
          [
            ["overview", "/admin/overview", "Översikt", CalendarDays],
            ["calendar", "/admin", "Kalender", CalendarDays],
            ["customers", "/admin/customers", "Kunder", Users],
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
      <div className="admin-account">
        <Link prefetch={false} href="/product">
          Om Booking Lab
        </Link>
        <Link prefetch={false} href="/">
          Visa kundbokningen
        </Link>
        <AdminActions mode="logout" />
      </div>
    </header>
  );
}
