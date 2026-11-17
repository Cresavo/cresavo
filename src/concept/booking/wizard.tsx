"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, BellRing, Check } from "lucide-react";
import { addDays } from "../data/dates";
import type { DemoState } from "../data/types";
import { t } from "../i18n";
import { formatDayLong } from "../i18n/format";
import { packOf } from "../packs";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { cx } from "../ui/cx";
import { showToast } from "../ui/toast";
import type { Now } from "../use-now";
import { AskStep } from "./ask-step";
import { DetailsStep } from "./details-step";
import { parseBookingRequest, type BookingRequest } from "./request";
import { ServiceInfo } from "./service-row";
import { SlotCard } from "./slot-card";
import { suggestSlots, type OpenSlot } from "./suggest";
import { TimePicker } from "./time-picker";
import { WaitlistSheet, type WaitlistRequest } from "./waitlist-sheet";

type Step = "ask" | "service" | "suggest" | "times" | "details";

const PROGRESS: Partial<Record<Step, number>> = { service: 0, suggest: 1, times: 1, details: 2 };
const PROGRESS_LABELS = ["booking.step.treatment", "booking.step.time", "booking.step.details"] as const;
const FALLBACK_DAYS = 21;

function Progress({ step }: { step: Step }) {
  const current = PROGRESS[step];
  if (current === undefined) return null;
  return (
    <ol className="flex items-center gap-2 text-xs" aria-label={t("booking.progress")}>
      {PROGRESS_LABELS.map((label, index) => (
        <li key={label} aria-current={index === current ? "step" : undefined} className={cx("flex items-center gap-1.5", index === current ? "font-semibold text-eko-ink" : "text-eko-muted")}>
          <span className={cx("flex size-5 items-center justify-center rounded-full text-[11px]", index < current ? "bg-eko-accent text-eko-on-accent" : index === current ? "bg-eko-ink text-eko-bg" : "bg-eko-sunken")}>
            {index < current ? <Check size={12} /> : index + 1}
          </span>
          {t(label)}
          {index < PROGRESS_LABELS.length - 1 && <span className="mx-1 h-px w-4 bg-eko-line" />}
        </li>
      ))}
    </ol>
  );
}

interface WizardProps {
  state: DemoState;
  now: Now;
  /** Start with this treatment already chosen (from "Book" buttons and rebooking). */
  initialServiceId?: string;
  onBooked?: (id: string) => void;
  /** Called with true while a flow step is open, false on the first screen. */
  onFlowChange?: (inFlow: boolean) => void;
}

/** The booking flow: describe it, or pick treatment, then time, then name and phone. */
export function BookingWizard({ state, now, initialServiceId, onBooked, onFlowChange }: WizardProps) {
  const [trail, setTrail] = useState<Step[]>(initialServiceId ? ["ask", "times"] : ["ask"]);
  const [serviceId, setServiceId] = useState(initialServiceId);
  const [request, setRequest] = useState<BookingRequest>();
  const [slot, setSlot] = useState<OpenSlot>();
  const [waitlist, setWaitlist] = useState<WaitlistRequest | null>(null);
  const [missed, setMissed] = useState(false);
  const step = trail[trail.length - 1];
  useEffect(() => onFlowChange?.(step !== "ask"), [step, onFlowChange]);
  const go = (next: Step) => setTrail((current) => [...current, next]);
  const back = () => setTrail((current) => current.slice(0, -1));
  const service = state.services.find((s) => s.id === serviceId);
  const pack = packOf(state);
  const nameOf = (id: string) => state.services.find((s) => s.id === id)?.name ?? id;
  const askServices: [string, string, string] = [nameOf(pack.requests.returning.serviceId), nameOf(pack.requests.newClient.serviceId), nameOf(pack.featured[2])];

  const ask =(text: string) => {
    const parsed = parseBookingRequest(text, state, now.today);
    setRequest(parsed);
    setServiceId(parsed.serviceId);
    setMissed(!parsed.serviceId);
    go(parsed.serviceId ? "suggest" : "service");
  };

  const chooseService = (id: string) => {
    setServiceId(id);
    go(request ? "suggest" : "times");
  };

  const pick = (chosen: OpenSlot) => {
    setSlot(chosen);
    go("details");
  };

  const taken = () => {
    showToast(t("booking.slotTaken"));
    setTrail((current) => current.slice(0, current.lastIndexOf("details")));
  };

  const body: Record<Step, ReactNode> = {
    ask: <AskStep services={askServices} onAsk={ask} onChoose={() => go("service")} />,
    service: (
      <div className="space-y-5">
        <h2 className="text-xl font-semibold tracking-tight">{missed ? t("booking.service.missed") : t("booking.service.title")}</h2>
        {packOf(state).categories.map((category) => (
          <div key={category} className="space-y-2">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-eko-muted">{t(`category.${category}`)}</p>
            {state.services
              .filter((s) => s.category === category)
              .map((s) => (
                <button key={s.id} onClick={() => chooseService(s.id)} className="flex w-full rounded-2xl bg-eko-surface p-3.5 text-left ring-1 ring-inset ring-eko-line transition-colors hover:bg-eko-accent-soft hover:ring-eko-accent">
                  <ServiceInfo service={s} staff={state.staff} />
                </button>
              ))}
          </div>
        ))}
      </div>
    ),
    suggest: service && request && <Suggestions state={state} now={now} service={service} request={request} onPick={pick} onAll={() => go("times")} onChangeService={() => go("service")} onWaitlist={(date) => setWaitlist({ serviceId: service.id, date })} />,
    times: service && (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">{t("booking.times.title", { service: service.name })}</h2>
        <TimePicker state={state} serviceId={service.id} clock={now} onPick={pick} onWaitlist={(date) => setWaitlist({ serviceId: service.id, date })} />
      </div>
    ),
    details: service && slot && <DetailsStep state={state} now={now} serviceId={service.id} slot={slot} onTaken={taken} onBooked={onBooked} />,
  };

  return (
    <Card className="space-y-5 p-5 sm:p-6">
      {step !== "ask" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={back} className="-ml-2">
            {t("common.back")}
          </Button>
          <Progress step={step} />
        </div>
      )}
      {body[step]}
      <WaitlistSheet state={state} now={now} request={waitlist} onClose={() => setWaitlist(null)} />
    </Card>
  );
}

interface SuggestionsProps {
  state: DemoState;
  now: Now;
  service: DemoState["services"][number];
  request: BookingRequest;
  onPick: (slot: OpenSlot) => void;
  onAll: () => void;
  onChangeService: () => void;
  onWaitlist: (date: string) => void;
}

/** Three times that fit the request, or the nearest ones with a waiting-list offer. */
function Suggestions({ state, now, service, request, onPick, onAll, onChangeService, onWaitlist }: SuggestionsProps) {
  const { exact, fallback } = useMemo(() => {
    const query = { serviceId: service.id, staffId: request.staffId, from: request.from, to: request.to, period: request.period, time: request.time };
    const found = suggestSlots(state, query, now);
    if (found.length) return { exact: found, fallback: [] };
    const nearest = suggestSlots(state, { serviceId: service.id, from: request.from, to: addDays(request.from, FALLBACK_DAYS) }, now);
    return { exact: [], fallback: nearest };
  }, [state, now, service.id, request]);
  const shown = exact.length ? exact : fallback;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{exact.length ? t("booking.suggest.title") : t("booking.suggest.none")}</h2>
        <p className="mt-1 text-[15px] text-eko-muted">
          {exact.length ? t("booking.suggest.for", { service: service.name }) : t("booking.suggest.noneHelp", { service: service.name })}
        </p>
      </div>
      <div className="space-y-3">
        {shown.map((slot) => (
          <SlotCard key={`${slot.date}-${slot.start}`} slot={slot} service={service} staff={state.staff} today={now.today} onPick={() => onPick(slot)} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onAll}>{t("booking.suggest.all")}</Button>
        <Button variant="ghost" onClick={onChangeService}>{t("booking.suggest.change")}</Button>
        {!exact.length && state.modules.waitlist && (
          <Button variant="secondary" icon={<BellRing size={16} />} onClick={() => onWaitlist(request.from)}>
            {t("booking.notifyMeFor", { day: formatDayLong(request.from) })}
          </Button>
        )}
      </div>
    </div>
  );
}
