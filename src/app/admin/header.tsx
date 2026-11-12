import Link from "next/link";
import AdminActions from "./ui";
export default function AdminHeader({
  email,
  active,
}: {
  email: string;
  active: "calendar" | "services" | "staff" | "campaigns";
}) {
  return (
    <header className="admin-header">
      <div className="admin-brand">
        <a href="/admin">
          SALONG EKO <span>/ DEMO</span>
        </a>
        <p>Inloggad som {email}</p>
      </div>
      <nav aria-label="Administration">
        {[
          ["calendar", "/admin", "Kalender"],
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
        <Link prefetch={false} href="/">
          Bokningssidan
        </Link>
        <AdminActions mode="logout" />
      </div>
    </header>
  );
}
