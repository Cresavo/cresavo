"use client";
import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type FormEvent,
} from "react";
import { DateTime } from "luxon";
import { Lightbulb, RefreshCw, CalendarDays } from "lucide-react";
import Link from "next/link";
import type { CapacityQuery, listCapacity } from "@/lib/capacity";
import { formatBookingTime, formatPrice, readableDay } from "@/lib/format";
import DatePicker from "@/app/components/date-picker";
import ContextLink, { rememberReturn } from "@/app/components/context-link";

import { useUnsavedChanges } from "../use-write";
import { useLocale } from "../../components/locale-provider";
import { text } from "@/lib/locale";
import { presentationError } from "@/lib/presentation-errors";

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
  const locale = useLocale();
  const t = (en: string, sv: string) => text(locale, en, sv);
  const [result, setResult] = useState(initial),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [dirtyCards, setDirtyCards] = useState<Record<string, boolean>>({});
  useUnsavedChanges(Object.values(dirtyCards).some(Boolean));
  const setDraftDirty = useCallback((id: string, dirty: boolean) => {
    setDirtyCards((current) => {
      if (!!current[id] === dirty) return current;
      const next = { ...current };
      if (dirty) next[id] = true;
      else delete next[id];
      return next;
    });
  }, []);
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
    <section
      aria-label={t(
        "Available capacity suggestions",
        "Förslag från ledig kapacitet",
      )}
      aria-busy={pending}
    >
      <div className="capacity-toolbar">
        <details className="capacity-context">
          <summary>{t("About these suggestions", "Om förslagen")}</summary>
          <p>
            {t(
              "Based on cancellations and current schedules. A suggestion does not reserve a time.",
              "Förslagen bygger på verkliga avbokningar och aktuella scheman. Ett förslag reserverar ingen tid.",
            )}
          </p>
          <p>
            {t("Updated", "Hämtat")}{" "}
            {formatBookingTime(result.fetchedAt, locale)} ·{" "}
            {readableDay(result.from, locale)}–
            {readableDay(result.until, locale)}
          </p>
        </details>
        <button
          className="secondary"
          type="button"
          onClick={refresh}
          disabled={pending}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {pending
            ? t("Refreshing…", "Uppdaterar…")
            : t("Refresh suggestions", "Uppdatera förslagen")}
        </button>
      </div>
      {error && <p role="alert">{presentationError(error, locale)}</p>}
      {(query.cursor || result.nextCursor) && (
        <nav
          className="action-row capacity-pages"
          aria-label={t("Suggestion pages", "Förslagssidor")}
        >
          <p>
            {t(
              `Cancellations in time order, up to ${query.limit} per page. Resolved and outdated suggestions remain for follow-up.`,
              `Avbokningar i tidsordning, högst ${query.limit} per sida. Även hanterade och inaktuella finns kvar för uppföljning.`,
            )}
          </p>
          {query.cursor && (
            <Link prefetch={false} href="/admin/overview">
              {t("First page", "Till första sidan")}
            </Link>
          )}
          {result.nextCursor && (
            <Link
              prefetch={false}
              href={`/admin/overview?${queryString({ ...query, from: result.from, cursor: result.nextCursor })}`}
            >
              {t("Next suggestions", "Nästa förslag")}{" "}
              <span aria-hidden="true">→</span>
            </Link>
          )}
        </nav>
      )}
      {!result.suggestions.length && (
        <div className="empty-state">
          <h2>
            {t(
              "No cancelled times to review",
              "Inga avbokade tider att ta ställning till",
            )}
          </h2>
          <p>
            {t("Continue in the", "Du kan fortsätta arbeta i")}{" "}
            <Link href="/admin">{t("calendar", "kalendern")}</Link>.
            {t(
              " Refresh here after a future cancellation.",
              " Uppdatera här efter en framtida avbokning.",
            )}
          </p>
        </div>
      )}
      {result.suggestions.length > 0 && (
        <h2>{t("Suggestions and follow-up", "Förslag och uppföljning")}</h2>
      )}
      <div className="capacity-grid">
        {result.suggestions.map((s) => (
          <CapacityCard
            key={`${s.bookingId}:${s.sourceVersion}:${s.expectedToken}`}
            suggestion={s}
            refresh={refresh}
            setDraftDirty={setDraftDirty}
          />
        ))}
      </div>
    </section>
  );
}
function CapacityCard({
  suggestion: s,
  refresh,
  setDraftDirty,
}: {
  suggestion: Suggestion;
  refresh: () => Promise<void>;
  setDraftDirty: (id: string, dirty: boolean) => void;
}) {
  const locale = useLocale();
  const t = (en: string, sv: string) => text(locale, en, sv);
  // Keep the initial default stable across language changes so a switch cannot
  // mark an untouched draft dirty or replace something the owner has typed.
  const [defaultTitle] = useState(() =>
    t(
      `Available times for ${s.serviceName}`,
      `Lediga tider för ${s.serviceName}`,
    ),
  );
  const day = DateTime.fromISO(s.startsAt)
    .setZone("Europe/Stockholm")
    .toISODate()!;
  const [title, setTitle] = useState(defaultTitle),
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
  const dirty =
    canAct &&
    (title !== defaultTitle ||
      from !== day ||
      until !== day ||
      discount !== "");
  useEffect(() => {
    setDraftDirty(s.bookingId, dirty);
    return () => setDraftDirty(s.bookingId, false);
  }, [s.bookingId, dirty, setDraftDirty]);
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
      window.location.assign(rememberReturn(result.calendarHref));
    } catch (e) {
      setMessage(presentationError((e as Error).message, locale));
      setPending(false);
    }
  }
  async function dismiss() {
    setPending(true);
    setMessage("");
    try {
      await request("dismiss");
      setMessage(t("Suggestion dismissed.", "Förslaget är avfärdat."));
      await refresh();
    } catch (e) {
      setMessage(presentationError((e as Error).message, locale));
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
          t(
            "Campaign draft saved. No time is reserved and nothing is published.",
            "Kampanjutkastet är sparat. Ingen tid är reserverad och inget är publicerat.",
          ),
        );
        await refresh();
      }
    } catch (e) {
      setMessage(presentationError((e as Error).message, locale));
    } finally {
      setPending(false);
    }
  }
  return (
    <article
      className="panel capacity-card"
      data-state={!s.available ? "stale" : s.status}
      aria-label={`${s.serviceName} ${formatBookingTime(s.startsAt, locale)}`}
    >
      <p className="eyebrow capacity-state">
        <Lightbulb size={16} aria-hidden="true" />
        {s.available
          ? t("Available cancellation", "Bokningsbar avbokning")
          : t("Outdated suggestion", "Inaktuellt underlag")}{" "}
        ·{" "}
        {s.status === "dismissed"
          ? t("Dismissed", "Avfärdat")
          : s.status === "draft"
            ? t("Draft saved", "Utkast sparat")
            : s.available
              ? t("Suggestion · needs a decision", "Förslag · behöver beslut")
              : t("No action taken", "Ingen åtgärd genomförd")}
      </p>
      <h2>{s.serviceName}</h2>
      <p className="capacity-appointment">
        <CalendarDays size={16} aria-hidden="true" />
        <strong>{formatBookingTime(s.startsAt, locale)}</strong> · {s.staffName}{" "}
        · {s.duration} min{" "}
        {s.priceOre !== null && `· ${formatPrice(s.priceOre, locale)}`}
      </p>
      <p>
        {locale === "sv"
          ? s.reason
          : s.available
            ? "A cancellation has opened an available time."
            : "This time is no longer bookable under the current rules."}
      </p>
      {s.decidedAt && (
        <p>
          {t("Decision saved", "Beslut sparat")}{" "}
          {formatBookingTime(s.decidedAt, locale)}.
        </p>
      )}
      {s.campaign && (
        <p>
          <ContextLink href={`/admin/campaigns#campaign-${s.campaign.id}`}>
            {s.campaign.published
              ? t("View published campaign", "Visa publicerad kampanj")
              : t(
                  "Review saved campaign draft",
                  "Granska sparat kampanjutkast",
                )}
          </ContextLink>
          . {s.campaign.discountPercent} % {t("off the service", "på tjänsten")}{" "}
          {readableDay(s.campaign.validFrom, locale)}–
          {readableDay(s.campaign.validUntil, locale)}.{" "}
          {t(
            "Applies beyond this single slot.",
            "Gäller inte bara denna lucka.",
          )}
        </p>
      )}
      {s.status === "draft" && !s.available && (
        <p>
          {t(
            "The draft is saved, but this time is no longer available. Review the campaign before publishing.",
            "Utkastet finns kvar, men tiden är inte längre bokningsbar. Granska kampanjen innan du publicerar.",
          )}
        </p>
      )}
      <div className="action-row">
        <button
          type="button"
          onClick={calendar}
          disabled={pending || !s.available}
        >
          {t("Open calendar", "Öppna kalendern")}
        </button>
        {!s.available && (
          <button
            type="button"
            className="secondary"
            disabled={pending}
            onClick={refresh}
          >
            {t("Refresh availability", "Uppdatera underlaget")}
          </button>
        )}
        {canAct && (
          <button
            type="button"
            className="secondary"
            onClick={dismiss}
            disabled={pending}
          >
            {t("Dismiss suggestion", "Avfärda förslaget")}
          </button>
        )}
      </div>
      {message && <p role="status">{message}</p>}
      {canAct && (
        <details className="capacity-draft">
          <summary>
            {t("Prepare campaign draft", "Förbered kampanjutkast")}
          </summary>
          <p>
            {t(
              "Choose a discount and validity period. Review the offer before saving.",
              "Välj rabatt och giltighetsperiod. Du granskar erbjudandet innan det sparas.",
            )}
          </p>
          <form onSubmit={draft} onChange={() => setPreview(false)}>
            <label htmlFor={`title-${s.bookingId}`}>
              {t("Title", "Rubrik")}
            </label>
            <input
              id={`title-${s.bookingId}`}
              maxLength={100}
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={pending}
            />
            <label htmlFor={`discount-${s.bookingId}`}>
              {t("Discount percent", "Rabatt i procent")}
            </label>
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
                label={t("Campaign starts", "Kampanjen börjar")}
                value={from}
                onChange={(v) => {
                  setFrom(v);
                  setPreview(false);
                }}
                disabled={pending}
              />
              <DatePicker
                id={`until-${s.bookingId}`}
                label={t("Campaign ends", "Kampanjen slutar")}
                value={until}
                onChange={(v) => {
                  setUntil(v);
                  setPreview(false);
                }}
                disabled={pending}
              />
            </div>
            <p className="capacity-scope">
              <strong>{t("Actual scope:", "Verklig omfattning:")}</strong>{" "}
              {s.serviceName}, {readableDay(from, locale)}–
              {readableDay(until, locale)}
              {t(
                ", all available times and team members for this service. The campaign is not limited to this cancelled slot. No time is reserved. The demo does not automatically change the booking price.",
                ", alla bokningsbara tider och utförare för tjänsten. Kampanjen är inte begränsad till den avbokade tiden. Ingen tid reserveras. Ordinarie bokningspris ändras inte automatiskt i demon.",
              )}
            </p>
            {preview && (
              <div className="empty-state" role="status">
                <h3>{t("Preview", "Förhandsgranskning")}</h3>
                <p>
                  {title} · {discount} % · {s.serviceName} ·{" "}
                  {readableDay(from, locale)}–{readableDay(until, locale)}
                </p>
                <p>
                  {t(
                    "Saved as a draft for your review. Nothing is published or sent.",
                    "Sparas som utkast för din granskning. Inget publiceras eller skickas.",
                  )}
                </p>
              </div>
            )}
            <div className="action-row">
              <button type="submit" disabled={pending}>
                {pending
                  ? t("Checking…", "Kontrollerar…")
                  : preview
                    ? t("Save campaign draft", "Spara kampanjutkast")
                    : t("Preview draft", "Förhandsgranska utkast")}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={pending}
                onClick={(event) => {
                  setTitle(defaultTitle);
                  setFrom(day);
                  setUntil(day);
                  setDiscount("");
                  setPreview(false);
                  setMessage("");
                  const details = event.currentTarget.closest("details");
                  if (details) {
                    details.open = false;
                    details.querySelector("summary")?.focus();
                  }
                }}
              >
                {t("Discard draft changes", "Avbryt utkast")}
              </button>
            </div>
          </form>
        </details>
      )}
    </article>
  );
}
