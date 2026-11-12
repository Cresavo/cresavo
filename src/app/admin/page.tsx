import { formatPrice } from "@/lib/format";
import { pageDataFailure } from "@/lib/errors";
import Link from "next/link";
import { getAdminContext } from "@/lib/auth";
import {
  adminBookingFilter,
  listBookings,
  listCampaigns,
  listServices,
} from "@/lib/domain";
import AdminActions from "./ui";
export const dynamic = "force-dynamic";
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; cursor?: string }>;
}) {
  const admin = await getAdminContext();
  if (!admin)
    return (
      <main className="max-w-md mx-auto px-5 py-12">
        <Link href="/">← Bokningssidan</Link>
        <h1 className="text-3xl font-bold my-6">Administration</h1>
        <AdminActions mode="login" />
      </main>
    );
  const params = await searchParams;
  const { filter, error } = adminBookingFilter(params);
  const [result, campaigns, services] = await Promise.all([
    listBookings(filter),
    listCampaigns(),
    listServices(),
  ]).catch(pageDataFailure);
  const { bookings } = result;
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    dateStyle: "full",
    timeStyle: "short",
  });
  return (
    <main className="max-w-4xl mx-auto px-5 py-10">
      <Link href="/">← Bokningssidan</Link>
      <header className="flex flex-wrap items-center justify-between gap-4 my-6">
        <h1 className="text-3xl font-bold">Administration</h1>
        <p>Inloggad som {admin.email}</p>
        <AdminActions mode="logout" />
      </header>
      <section className="bg-white rounded-xl p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Kalender och bokningar</h2>
        {error && <p role="alert">{error}</p>}
        <form className="mb-4" method="get">
          <label htmlFor="from">Från</label>
          <input
            id="from"
            name="from"
            type="text"
            placeholder="YYYY-MM-DD"
            pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"
            defaultValue={result.from}
            required
          />
          <label htmlFor="to">Till (max 31 dagar)</label>
          <input
            id="to"
            name="to"
            type="text"
            placeholder="YYYY-MM-DD"
            pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"
            defaultValue={result.to}
            required
          />
          <button>Visa bokningar</button>
        </form>
        {!bookings.length && <p>Inga bokningar ännu.</p>}
        <ul className="space-y-4">
          {bookings.map((b) => (
            <li key={b.id} className="border-t pt-3">
              <strong>{fmt.format(b.startsAt)}</strong>
              <p>
                {b.service.name} · {b.customerName} · {b.customerEmail}
              </p>
            </li>
          ))}
        </ul>
        {result.nextCursor && (
          <Link
            href={`/admin?${new URLSearchParams({ from: result.from, to: result.to, cursor: result.nextCursor })}`}
          >
            Nästa sida
          </Link>
        )}
      </section>
      <section className="bg-white rounded-xl p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Tjänster</h2>
        {services.map((s) => (
          <p key={s.id}>
            {s.name} · {s.duration} min · {formatPrice(s.priceOre)}
          </p>
        ))}
      </section>
      <section className="bg-white rounded-xl p-6">
        <h2 className="text-xl font-bold mb-4">Kampanjer</h2>
        {!campaigns.length && (
          <p>Inga kampanjer ännu. Skapa ett utkast via lokal MCP.</p>
        )}
        {campaigns.map((c) => (
          <div key={c.id} className="border-t py-4">
            <strong>{c.title}</strong>
            <p>
              {c.discountPercent} % · {c.service.name} · {c.validFrom}–
              {c.validUntil}
            </p>
            {c.published ? (
              <p>Publicerad</p>
            ) : (
              <AdminActions mode="publish" id={c.id} />
            )}
          </div>
        ))}
      </section>
    </main>
  );
}
