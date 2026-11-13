"use client";
import { useRef, useState, type FormEvent } from "react";
import { DateTime } from "luxon";
import Link from "next/link";
import type { CapacityQuery, listCapacity } from "@/lib/capacity";
import { formatBookingTime, formatPrice, readableDay } from "@/lib/format";
import DatePicker from "@/app/components/date-picker";

type Result = Awaited<ReturnType<typeof listCapacity>>;
type Suggestion = Result["suggestions"][number];
function queryString(query: CapacityQuery) {
  const params = new URLSearchParams({
    days: String(query.days),
    limit: String(query.limit),
  });
  if (query.from) params.set("from", query.from);
  if (query.cursor) params.set("cursor", query.cursor);
  return params.toString();
}
async function load(query: CapacityQuery) {
  const r = await fetch(`/api/admin/capacity?${queryString(query)}`, {
    cache: "no-store",
  }).catch(() => {
    throw Error("Översikten kunde inte hämtas. Försök uppdatera igen.");
  });
  if (!r.ok)
    throw Error("Översikten kunde inte hämtas. Försök uppdatera igen.");
  return (await r.json()) as Result;
}
export default function CapacityOverview({
  initial,
  query,
}: {
  initial: Result;
  query: CapacityQuery;
}) {
  const [result, setResult] = useState(initial),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function refresh() {
    setPending(true);
    setError("");
    try {
      setResult(await load(query));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <section aria-label="Förslag från ledig kapacitet" aria-busy={pending}>
      <div className="action-row">
        <p>
          Hämtat {formatBookingTime(result.fetchedAt)} ·{" "}
          {readableDay(result.from)}–{readableDay(result.until)}
        </p>
        <button type="button" onClick={refresh} disabled={pending}>
          {pending ? "Uppdaterar…" : "Uppdatera förslagen"}
        </button>
      </div>
      <p className="muted">
        Ett förslag reserverar ingen tid. Uppdatera när bokningar eller scheman
        ändras.
      </p>
      {error && <p role="alert">{error}</p>}
      {(query.cursor || result.nextCursor) && (
        <nav className="action-row capacity-pages" aria-label="Förslagssidor">
          <p>
            Avbokningar i tidsordning, högst {query.limit} per sida. Även
            hanterade och inaktuella finns kvar för uppföljning.
          </p>
          {query.cursor && (
            <Link prefetch={false} href="/admin/overview">
              Till första sidan
            </Link>
          )}
          {result.nextCursor && (
            <Link
              prefetch={false}
              href={`/admin/overview?${queryString({ ...query, from: result.from, cursor: result.nextCursor })}`}
            >
              Nästa förslag <span aria-hidden="true">→</span>
            </Link>
          )}
        </nav>
      )}
      {!result.suggestions.length && (
        <div className="empty-state">
          <h2>Inga avbokade tider att ta ställning till</h2>
          <p>
            Du kan fortsätta arbeta i <Link href="/admin">kalendern</Link>.
            Uppdatera här efter en framtida avbokning.
          </p>
        </div>
      )}
      {result.suggestions.map((s) => (
        <CapacityCard
          key={`${s.bookingId}:${s.sourceVersion}:${s.expectedToken}`}
          suggestion={s}
          refresh={refresh}
        />
      ))}
    </section>
  );
}
function CapacityCard({
  suggestion: s,
  refresh,
}: {
  suggestion: Suggestion;
  refresh: () => Promise<void>;
}) {
  const day = DateTime.fromISO(s.startsAt)
    .setZone("Europe/Stockholm")
    .toISODate()!;
  const [title, setTitle] = useState(`Lediga tider för ${s.serviceName}`),
    [from, setFrom] = useState(day),
    [until, setUntil] = useState(day),
    [discount, setDiscount] = useState("");
  const [preview, setPreview] = useState(false),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  const source = {
    bookingId: s.bookingId,
    sourceVersion: s.sourceVersion,
    expectedToken: s.expectedToken,
  };
  const canAct = s.available && s.status === "new";
  async function request(
    action: "calendar" | "preview" | "dismiss" | "draft",
    input: unknown = source,
  ) {
    const payload = JSON.stringify({ action, input });
    if (!attempt.current || attempt.current.payload !== payload)
      attempt.current = { payload, key: crypto.randomUUID() };
    const r = await fetch("/api/admin/capacity", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": attempt.current.key,
      },
      body: payload,
    }).catch(() => {
      throw Error(
        "Anslutningen avbröts. Försök igen; samma åtgärd skapar inte dubbla utkast.",
      );
    });
    const result = await r.json().catch(() => {
      throw Error(
        "Svaret kunde inte läsas. Uppdatera översikten eller försök igen.",
      );
    });
    if (!r.ok)
      throw Error(
        result.error ?? "Åtgärden kunde inte slutföras. Uppdatera översikten.",
      );
    return result;
  }
  async function calendar() {
    setPending(true);
    setMessage("");
    try {
      const result = await request("calendar");
      window.location.assign(result.calendarHref);
    } catch (e) {
      setMessage((e as Error).message);
      setPending(false);
    }
  }
  async function dismiss() {
    setPending(true);
    setMessage("");
    try {
      await request("dismiss");
      setMessage("Förslaget är avfärdat.");
      await refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  async function draft(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const input = {
        ...source,
        campaign: {
          serviceId: s.serviceId,
          title,
          discountPercent: Number(discount),
          validFrom: from,
          validUntil: until,
        },
      };
      if (!preview) {
        await request("preview", input);
        setPreview(true);
      } else {
        await request("draft", input);
        setMessage(
          "Kampanjutkastet är sparat. Ingen tid är reserverad och inget är publicerat.",
        );
        await refresh();
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <article
      className="panel capacity-card"
      aria-label={`${s.serviceName} ${formatBookingTime(s.startsAt)}`}
    >
      <p className="eyebrow">
        {s.available ? "Bokningsbar avbokning" : "Inaktuellt underlag"} ·{" "}
        {s.status === "dismissed"
          ? "Avfärdat"
          : s.status === "draft"
            ? "Utkast sparat"
            : "Behöver beslut"}
      </p>
      <h2>{s.serviceName}</h2>
      <p>
        <strong>{formatBookingTime(s.startsAt)}</strong> · {s.staffName} ·{" "}
        {s.duration} min {s.priceOre !== null && `· ${formatPrice(s.priceOre)}`}
      </p>
      <p>{s.reason}</p>
      {s.decidedAt && <p>Beslut sparat {formatBookingTime(s.decidedAt)}.</p>}
      {s.campaign && (
        <p>
          <Link href={`/admin/campaigns#campaign-${s.campaign.id}`}>
            {s.campaign.published
              ? "Visa publicerad kampanj"
              : "Granska sparat kampanjutkast"}
          </Link>
          . {s.campaign.discountPercent} % på tjänsten{" "}
          {readableDay(s.campaign.validFrom)}–
          {readableDay(s.campaign.validUntil)}. Gäller inte bara denna lucka.
        </p>
      )}
      {s.status === "draft" && !s.available && (
        <p>
          Utkastet finns kvar, men tiden är inte längre bokningsbar. Granska
          kampanjen innan du publicerar.
        </p>
      )}
      <div className="action-row">
        <button
          type="button"
          onClick={calendar}
          disabled={pending || !s.available}
        >
          Öppna kalendern
        </button>
        {canAct && (
          <button
            type="button"
            className="secondary"
            onClick={dismiss}
            disabled={pending}
          >
            Avfärda förslaget
          </button>
        )}
      </div>
      {message && <p role="status">{message}</p>}
      {canAct && (
        <details className="capacity-draft">
          <summary>Förbered kampanjutkast</summary>
          <p>
            Välj själv rabatt och giltighetsperiod. Den befintliga
            kampanjmodellen kräver 1–100 % rabatt.
          </p>
          <form onSubmit={draft} onChange={() => setPreview(false)}>
            <label htmlFor={`title-${s.bookingId}`}>Rubrik</label>
            <input
              id={`title-${s.bookingId}`}
              maxLength={100}
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={pending}
            />
            <label htmlFor={`discount-${s.bookingId}`}>Rabatt i procent</label>
            <input
              id={`discount-${s.bookingId}`}
              type="number"
              min={1}
              max={100}
              required
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              disabled={pending}
            />
            <div className="capacity-dates">
              <DatePicker
                id={`from-${s.bookingId}`}
                label="Kampanjen börjar"
                value={from}
                onChange={(v) => {
                  setFrom(v);
                  setPreview(false);
                }}
                disabled={pending}
              />
              <DatePicker
                id={`until-${s.bookingId}`}
                label="Kampanjen slutar"
                value={until}
                onChange={(v) => {
                  setUntil(v);
                  setPreview(false);
                }}
                disabled={pending}
              />
            </div>
            <p className="capacity-scope">
              <strong>Verklig omfattning:</strong> {s.serviceName},{" "}
              {readableDay(from)}–{readableDay(until)}, alla bokningsbara tider
              och utförare för tjänsten. Kampanjen är inte begränsad till den
              avbokade tiden. Ingen tid reserveras. Ordinarie bokningspris
              ändras inte automatiskt i demon.
            </p>
            {preview && (
              <div className="empty-state" role="status">
                <h3>Förhandsgranskning</h3>
                <p>
                  {title} · {discount} % · {s.serviceName} · {readableDay(from)}
                  –{readableDay(until)}
                </p>
                <p>
                  Sparas som utkast för din granskning. Inget publiceras eller
                  skickas.
                </p>
              </div>
            )}
            <button type="submit" disabled={pending}>
              {pending
                ? "Kontrollerar…"
                : preview
                  ? "Spara kampanjutkast"
                  : "Förhandsgranska utkast"}
            </button>
          </form>
        </details>
      )}
    </article>
  );
}
