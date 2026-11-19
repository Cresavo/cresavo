"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, BellRing, Check } from "lucide-react";
import { addDays } from "../data/dates";
import type { DemoState, StaffId } from "../data/types";
import { t, tc } from "../i18n";
import { formatDayLong } from "../i18n/format";
import { ActionFailure, type ActionFailureInfo } from "../ui/action-failure";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { cx } from "../ui/cx";
import type { Now } from "../use-now";
import { AskStep } from "./ask-step";
import { useGuestContact } from "./guest";
import { DetailsStep } from "./details-step";
import { parseBookingRequest, type BookingRequest } from "./request";
import { ServiceInfo } from "./service-row";
import { SlotCard } from "./slot-card";
import { suggestSlots, type OpenSlot } from "./suggest";
import { OtherTimes, TimePicker } from "./time-picker";
import { WaitlistSheet, type WaitlistRequest } from "./waitlist-sheet";

type Step = "ask" | "service" | "suggest" | "times" | "next" | "details";

const PROGRESS: Partial<Record<Step, number>> = { service: 0, suggest: 1, times: 1, next: 2, details: 2 };
const PROGRESS_LABELS = ["booking.step.treatment", "booking.step.time", "booking.step.details"] as const;
const FALLBACK_DAYS = 21;

function Progress({ step }: { step: Step }) {
  const current = PROGRESS[step];
  if (current === undefined) return null;
  return (
    <ol className="flex items-center gap-2 text-xs" aria-label={t("booking.progress")}>
      {PROGRESS_LABELS.map((label, index) => (
        <li key={label} aria-current={index === current ? "step" : undefined} className={cx("flex items-center gap-1.5", index === current ? "font-semibold text-text" : "text-text-secondary")}>
          <span className={cx("flex size-5 items-center justify-center rounded-full text-[11px]", index < current ? "bg-action text-on-action" : index === current ? "bg-text text-bg" : "bg-surface-2")}>
            {index < current ? <Check size={12} /> : index + 1}
          </span>
          {t(label)}
          {index < PROGRESS_LABELS.length - 1 && <span className="mx-1 h-px w-4 bg-border" />}
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
  initialStaffId?: StaffId;
  onBooked?: (id: string) => void;
  /** Called with true while a flow step is open, false on the first screen. */
  onFlowChange?: (inFlow: boolean) => void;
  /** The page already shows the price list, so the first screen need not offer one. */
  listOnPage?: boolean;
}

/** The booking flow: describe it, or pick treatment, then time, then name and phone. */
export function BookingWizard({ state, now, initialServiceId, initialStaffId, onBooked, onFlowChange, listOnPage }: WizardProps) {
  const nextTime = (serviceId: string, staffId?: StaffId) =>
    suggestSlots(state, { serviceId, staffId, from: now.today, to: addDays(now.today, FALLBACK_DAYS) }, now, 1)[0];
  const initialService = state.services.find(s => s.id === initialServiceId);
  const preferredStaff = initialService?.staffIds.find(id => id === initialStaffId);
  const [slot, setSlot] = useState(() => initialService ? nextTime(initialService.id, preferredStaff) : undefined);
  const [alternative, setAlternative] = useState(false);
  const [trail, setTrail] = useState<Step[]>(initialService ? ["ask", slot ? "next" : "times"] : ["ask"]);
  const [staffId, setStaffId] = useState(preferredStaff);
  const [serviceId, setServiceId] = useState(initialService?.id);
  const [request, setRequest] = useState<BookingRequest>();
  const contact = useGuestContact(state.salon.slug);
  const [waitlist, setWaitlist] = useState<WaitlistRequest | null>(null);
  const [missed, setMissed] = useState(false);
  const [failure, setFailure] = useState<ActionFailureInfo>();
  const step = trail[trail.length - 1];
  useEffect(() => onFlowChange?.(step !== "ask"), [step, onFlowChange]);
  const go = (next: Step) => setTrail((current) => [...current, next]);
  const back = () => {
    setFailure(undefined);
    setTrail((current) => current.slice(0, -1));
  };
  const service = state.services.find((s) => s.id === serviceId);
  const ask = (text: string) => {
    const parsed = parseBookingRequest(text, state, now.today);
    setRequest(parsed);
    setStaffId(undefined);
    setServiceId(parsed.serviceId);
    setMissed(!parsed.serviceId);
    go(parsed.serviceId ? "suggest" : "service");
  };

  const chooseService = (id: string) => {
    setStaffId(undefined);
    setServiceId(id);
    if (request) return go("suggest");
    const first = nextTime(id);
    setSlot(first);
    setAlternative(false);
    go(first ? "next" : "times");
  };

  const pick = (chosen: OpenSlot) => {
    setFailure(undefined);
    setSlot(chosen);
    go("details");
  };

  const taken = (error: ActionFailureInfo) => {
    setFailure(error);
    setSlot(undefined);
    setTrail((current) => current.at(-1) === "next" ? [...current.slice(0, -1), "times"] : current.slice(0, -1));
  };

  const stepPanel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (step !== "ask") stepPanel.current?.focus({ preventScroll: true });
  }, [step]);

  const details = service && slot && (
    <DetailsStep
      state={state} now={now} serviceId={service.id} slot={slot}
      contact={contact}
      suggested={step === "next" && !alternative} onTaken={taken} onBooked={onBooked}
      timeControl={step === "next" && (
        <OtherTimes state={state} serviceId={service.id} staffId={staffId} selected={alternative ? slot : undefined} clock={now}
          onPick={chosen => { setSlot(chosen); setAlternative(true); }}
          onWaitlist={date => setWaitlist({ serviceId: service.id, date, staffId })} />
      )}
    />
  );

  const body: Record<Step, ReactNode> = {
    ask: <AskStep onAsk={ask} onChoose={listOnPage ? undefined : () => go("service")} />,
    service: (
      <div className="space-y-5">
        <h2 className="text-xl font-semibold tracking-tight">{missed ? t("booking.service.missed") : t("booking.service.title")}</h2>
        {state.categories.filter((category) => state.services.some((s) => s.category === category.id)).map((category) => (
          <div key={category.id} className="space-y-2">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-text-secondary">{category.name}</p>
            {state.services
              .filter((s) => s.category === category.id)
              .map((s) => (
                <button key={s.id} onClick={() => chooseService(s.id)} className="flex w-full rounded-lg bg-surface p-3.5 text-left ring-1 ring-inset ring-hairline transition-colors hover:bg-action-bg hover:ring-action">
                  <ServiceInfo service={s} staff={state.staff} />
                </button>
              ))}
          </div>
        ))}
      </div>
    ),
    suggest: service && request && <Suggestions state={state} now={now} service={service} request={request} onPick={pick} onAll={() => go("times")} onChangeService={() => go("service")} onWaitlist={(date) => setWaitlist({ serviceId: service.id, date, staffId: service.staffIds.find(id => id === request.staffId) })} />,
    times: service && (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">{t("booking.times.title", { service: service.name })}</h2>
        <TimePicker state={state} serviceId={service.id} staffId={staffId} clock={now} onPick={pick} onWaitlist={(date) => setWaitlist({ serviceId: service.id, date, staffId })} />
      </div>
    ),
    next: details,
    details,
  };

  // Idle, the flow is one quiet line above the price list; a card appears once a booking is under way.
  if (step === "ask") return body.ask;
  return (
    <Card className="space-y-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={back} className="-ml-2">
          {t("common.back")}
        </Button>
        {step !== "next" && <Progress step={step} />}
      </div>
      {failure && <ActionFailure failure={failure} audience="booking" />}
      <div role="group" tabIndex={-1} ref={stepPanel} aria-label={t(PROGRESS_LABELS[PROGRESS[step] ?? 0])}>
        {body[step]}
      </div>
      {waitlist && <WaitlistSheet state={state} now={now} request={waitlist} onClose={() => setWaitlist(null)} />}
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
        <h2 className="text-xl font-semibold tracking-tight">{exact.length ? tc("booking.suggest.title", exact.length) : t("booking.suggest.none")}</h2>
        <p className="mt-1 text-[15px] text-text-secondary">
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
          <Button variant="secondary" className="max-w-full" icon={<BellRing size={16} className="shrink-0" />} onClick={() => onWaitlist(request.from)}>
            <span className="whitespace-normal text-center">{t("booking.notifyMeFor", { day: formatDayLong(request.from) })}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
