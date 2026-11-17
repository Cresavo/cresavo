"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CalendarPlus, Hand, Mail, MessageSquare, Phone, ShoppingBag, UserX } from "lucide-react";
import { diffDays } from "@/concept/data/dates";
import { t, tc } from "@/concept/i18n";
import { agoText, formatDate, formatMoney } from "@/concept/i18n/format";
import { nextVisitFor } from "@/concept/customers/return-visits";
import { notSeenInThreeMonths } from "@/concept/customers/segments";
import { servedBy, staffViewer } from "@/concept/ops/access";
import { useRole } from "@/concept/ops/role";
import { buildCustomerStats, findService, fullName } from "@/concept/selectors";
import { dispatch, undo } from "@/concept/store";
import { BackLink } from "@/concept/studio/back-link";
import { NoAccess } from "@/concept/studio/ops/no-access";
import { BookingSheets, type OpenSheet } from "@/concept/studio/booking/booking-sheets";
import { BookingList } from "@/concept/studio/customers/booking-list";
import { CustomerSummary } from "@/concept/studio/customers/customer-summary";
import { DeleteCustomer } from "@/concept/studio/customers/delete-customer";
import { Journal } from "@/concept/studio/customers/journal";
import { NextVisitCard } from "@/concept/studio/customers/next-visit-card";
import { Notes } from "@/concept/studio/customers/notes";
import { CustomerProducts } from "@/concept/studio/stock/customer-products";
import { SellSheet } from "@/concept/studio/stock/sell-sheet";
import { PageHeader } from "@/concept/studio/page-header";
import { useStudio } from "@/concept/studio/use-studio";
import { Avatar } from "@/concept/ui/avatar";
import { Badge } from "@/concept/ui/badge";
import { Button, ButtonLink, buttonClass } from "@/concept/ui/button";
import { Card, Section } from "@/concept/ui/card";
import { Segmented } from "@/concept/ui/controls";
import { EmptyState } from "@/concept/ui/empty-state";
import { showToast } from "@/concept/ui/toast";

type Tab = "overview" | "history" | "journal";

export default function CustomerPage() {
  const { id } = useParams<{ id: string }>() ?? { id: "" };
  const { state, today, minutes } = useStudio();
  const [tab, setTab] = useState<Tab>("overview");
  const [sheet, setSheet] = useState<OpenSheet>(null);
  const [selling, setSelling] = useState(false);
  const role = useRole();
  const viewer = role === "staff" ? staffViewer(state) : null;
  const customer = state.customers.find((c) => c.id === id);
  const stats = useMemo(() => buildCustomerStats(state, today), [state, today]);

  const back = <BackLink href="/studio/customers" label={t("customer.back")} />;
  if (!customer) {
    return (
      <>
        <PageHeader title={t("customer.notFound")} back={back} />
        <EmptyState icon={<UserX size={22} />} title={t("customer.notFound")} text={t("customer.notFoundText")} />
      </>
    );
  }

  if (viewer && !servedBy(state, viewer.id).has(customer.id)) return <NoAccess />;
  const s = stats.get(customer.id)!;
  const late = notSeenInThreeMonths(state, stats, today).some((c) => c.id === customer.id);
  const next = nextVisitFor(state, customer, stats);
  const journalNotes = state.journals.filter((j) => j.customerId === customer.id).sort((a, b) => b.date.localeCompare(a.date));
  const bookings = state.bookings.filter((b) => b.customerId === customer.id);
  const upcoming = bookings.filter((b) => b.status === "booked" && b.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  const history = bookings.filter((b) => b.date < today || b.status !== "booked").sort((a, b) => b.date.localeCompare(a.date) || b.start - a.start);
  const favorite = findService(state, s.lastServiceId ?? "");
  const sayHello = () => {
    dispatch({
      type: "inbox/add",
      item: { kind: "system", customerId: customer.id, date: today, time: minutes, title: t("customer.helloTitle", { name: customer.firstName }), body: t("customer.helloBody"), read: false, handled: true },
    });
    showToast(t("customer.helloToast", { name: customer.firstName }), { label: t("common.undo"), run: undo });
  };

  return (
    <>
      <PageHeader title={fullName(customer)} subtitle={t("customer.since", { date: formatDate(customer.since) })} back={back} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <Card className="space-y-4 p-5">
            <div className="flex items-center gap-4">
              <Avatar name={fullName(customer)} size="xl" />
              <div className="min-w-0 space-y-1.5">
                <p className="truncate text-lg font-semibold">{fullName(customer)}</p>
                <div className="flex flex-wrap gap-1.5">
                  {customer.tags.map((tag) => <Badge key={tag} tone={tag === "Diabetes" ? "warn" : "neutral"}>{tag}</Badge>)}
                  {customer.waitlist && state.modules.waitlist && <Badge tone="accent">{t("customer.waitlist")}</Badge>}
                </div>
              </div>
            </div>
            <CustomerSummary customer={customer} />
            <div className="space-y-1 text-sm">
              <a href={`tel:${customer.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 py-1 hover:text-action">
                <Phone size={16} className="text-text-secondary" />
                {customer.phone}
              </a>
              {customer.email && (
                <a href={`mailto:${customer.email}`} className="flex items-center gap-2 py-1 hover:text-action">
                  <Mail size={16} className="text-text-secondary" />
                  <span className="truncate">{customer.email}</span>
                </a>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button size="sm" className="px-2" icon={<CalendarPlus size={16} />} onClick={() => setSheet({ kind: "new", preset: { customerId: customer.id, serviceId: s.lastServiceId } })}>
                {t("customer.bookAgain")}
              </Button>
              <a href={`tel:${customer.phone.replace(/\s/g, "")}`} className={buttonClass("secondary", "sm", "px-2")}>
                <Phone size={16} />
                {t("next.call")}
              </a>
              <Button size="sm" variant="secondary" className="px-2" icon={<MessageSquare size={16} />} onClick={() => showToast(t("customer.textSimulated"))}>
                {t("customer.text")}
              </Button>
            </div>
          </Card>
          {state.modules.stock && !viewer && (
            <Button variant="secondary" className="w-full" icon={<ShoppingBag size={18} />} onClick={() => setSelling(true)}>
              {t("stock.sell")}
            </Button>
          )}
          <NextVisitCard customer={customer} next={next} lastVisit={s.lastVisit} />
          {late && s.lastVisit && (
            <Card className="flex gap-3 bg-warning-bg p-4 ring-warning/20">
              <Hand size={20} className="mt-0.5 shrink-0 text-warning" />
              <div className="space-y-2">
                <p className="text-sm">{tc("customer.lateText", Math.floor(diffDays(today, s.lastVisit) / 7))}</p>
                <Button size="sm" onClick={sayHello}>{t("customer.sayHello")}</Button>
              </div>
            </Card>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Fact label={t("customer.visits")} value={String(s.visits)} />
            {!viewer && <Fact label={t("customer.spent")} value={formatMoney(s.spent)} />}
            <Fact label={t("customer.lastVisit")} value={s.lastVisit ? agoText(s.lastVisit, today) : "–"} />
            <Fact label={t("customer.usually")} value={favorite?.name ?? "–"} />
          </div>
          {!viewer && <DeleteCustomer customer={customer} />}
        </div>

        <div className="min-w-0 space-y-5">
          <Segmented<Tab>
            label={t("customer.sections")}
            value={tab}
            onChange={setTab}
            className="w-full sm:w-auto"
            options={[
              { value: "overview", label: t("customer.tab.overview") },
              { value: "history", label: tc("customer.tab.history", history.length) },
              ...(state.modules.journal ? [{ value: "journal" as const, label: t("customer.tab.journal") }] : []),
            ]}
          />
          {tab === "overview" && (
            <>
              <Section title={t("notes.title")}>
                <Notes key={customer.note} customer={customer} />
              </Section>
              <Section title={t("customer.upcoming")}>
                {upcoming.length ? (
                  <Card className="overflow-hidden">
                    <BookingList bookings={upcoming} onOpen={setSheet} />
                  </Card>
                ) : (
                  <EmptyState
                    icon={<CalendarPlus size={22} />}
                    title={t("customer.noUpcoming")}
                    action={<Button size="sm" onClick={() => setSheet({ kind: "new", preset: { customerId: customer.id, serviceId: s.lastServiceId } })}>{t("customer.bookAgain")}</Button>}
                  />
                )}
              </Section>
            </>
          )}
          {tab === "history" && (
            <>
              <Card className="overflow-hidden">
                <BookingList bookings={history} onOpen={setSheet} />
              </Card>
              {state.modules.stock && !viewer && <CustomerProducts customerId={customer.id} />}
              {state.modules.journal && journalNotes.length > 0 && (
                <Section title={t("customer.journalNotes")} action={<Button size="sm" variant="ghost" onClick={() => setTab("journal")}>{t("customer.openJournal")}</Button>}>
                  <Card className="divide-y divide-border overflow-hidden">
                    {journalNotes.slice(0, 5).map((j) => (
                      <button key={j.id} onClick={() => setTab("journal")} className="block w-full px-4 py-3 text-left hover:bg-surface-2">
                        <span className="block text-xs text-text-secondary">{formatDate(j.date)}</span>
                        <span className="block truncate text-sm font-medium">{j.treatment}</span>
                        {j.observations && <span className="block truncate text-sm text-text-secondary">{j.observations}</span>}
                      </button>
                    ))}
                  </Card>
                </Section>
              )}
            </>
          )}
          {tab === "journal" && state.modules.journal && <Journal customer={customer} />}
          {tab === "journal" && !state.modules.journal && (
            <ButtonLink href="/studio/more/features" variant="secondary">{t("customer.journalOff")}</ButtonLink>
          )}
        </div>
      </div>
      <BookingSheets sheet={sheet} onChange={setSheet} />
      {selling && <SellSheet customerId={customer.id} onClose={() => setSelling(false)} />}
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3.5">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="mt-0.5 truncate font-semibold">{value}</p>
    </Card>
  );
}
