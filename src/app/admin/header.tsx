import Link from "next/link";
import AdminActions from "./ui";
import { demoAccessEnabled, DEMO_ADMIN_EMAIL } from "@/lib/demo-access";
export default function AdminHeader({
  email,
  active,
}: {
  email: string;
  active: "calendar" | "services" | "staff" | "campaigns" | "customers";
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
        {[
          ["calendar", "/admin", "Kalender"],
          ["customers", "/admin/customers", "Kunder"],
          ["services", "/admin/services", "Tjänster"],
          ["staff", "/admin/staff", "Personal & tider"],
          ["campaigns", "/admin/campaigns", "Kampanjer"],
        ].map(([key, href, label]) => (
          <a
            key={key}
            href={href}
            aria-current={active === key ? "page" : undefined}
          >
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
