import { prefillForHoliday } from "../../campaigns/prefill";
import type { Draft } from "../../campaigns/draft";
import type { DemoState, DateKey } from "../../data/types";
import { t } from "../../i18n";
import { formatDate } from "../../i18n/format";
import { applyGoal, GOALS, type Goal } from "../../campaigns/goals";
import { ChoiceCards, Chip, Field, Select, TextInput } from "../../ui/controls";

const DISCOUNTS = [0, 10, 15, 20, 25];
const HOLIDAYS_OFFERED = 6;

interface OfferStepProps {
  state: DemoState;
  today: DateKey;
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
}

/** Step 1: what is offered, to whom and when. Opens filled in; usually nothing needs changing. */
export function OfferStep({ state, today, draft, onChange }: OfferStepProps) {
  const toggle = (id: string) => {
    const next = draft.serviceIds.includes(id) ? draft.serviceIds.filter((s) => s !== id) : [...draft.serviceIds, id];
    if (next.length) onChange({ serviceIds: state.services.filter((s) => next.includes(s.id)).map((s) => s.id) });
  };
  const discounts = [...new Set([...DISCOUNTS, draft.discountPercent])].sort((a, b) => a - b);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <span className="block text-sm font-medium" aria-hidden>{t("campaigns.goal.question")}</span>
        <ChoiceCards<Goal>
          label={t("campaigns.goal.question")}
          value={(draft.goal ?? "") as Goal}
          onChange={(goal) => onChange(applyGoal(state, draft, goal, today))}
          options={GOALS.map((value) => ({ value, label: t(`campaigns.goal.${value}`) }))}
        />
      </div>
      <Field width="short" label={t("campaigns.offer.occasion")}>
        <Select
          value={draft.holidayId ?? ""}
          onChange={(event) => {
            const holiday = state.holidays.find((h) => h.id === event.target.value);
            onChange(holiday ? prefillForHoliday(state, holiday, today) : { holidayId: undefined });
          }}
        >
          <option value="">{t("campaigns.offer.noOccasion")}</option>
          {state.holidays.slice(0, HOLIDAYS_OFFERED).map((h) => (
            <option key={h.id} value={h.id}>{`${h.name} · ${formatDate(h.date)}`}</option>
          ))}
        </Select>
      </Field>
      <Field width="short" label={t("campaigns.offer.name")}>
        <TextInput value={draft.name} onChange={(event) => onChange({ name: event.target.value })} maxLength={60} />
      </Field>
      <div className="space-y-2">
        <span className="block text-sm font-medium">{t("campaigns.offer.services")}</span>
        <div className="flex flex-wrap gap-2">
          {state.services.map((s) => (
            <Chip key={s.id} active={draft.serviceIds.includes(s.id)} onClick={() => toggle(s.id)}>
              {s.name}
            </Chip>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <span className="block text-sm font-medium">{t("campaigns.offer.discount")}</span>
        <div className="flex flex-wrap gap-2">
          {discounts.map((percent) => (
            <Chip key={percent} active={draft.discountPercent === percent} onClick={() => onChange({ discountPercent: percent })}>
              {percent ? t("format.percent", { value: percent }) : t("campaigns.offer.noDiscount")}
            </Chip>
          ))}
        </div>
      </div>
      <div className="grid gap-3 min-[360px]:flex">
        <Field width="date" label={t("campaigns.offer.from")}>
          <TextInput type="date" value={draft.from} onChange={(event) => event.target.value && onChange({ from: event.target.value, to: draft.to < event.target.value ? event.target.value : draft.to })} />
        </Field>
        <Field width="date" label={t("campaigns.offer.to")}>
          <TextInput type="date" value={draft.to} min={draft.from} onChange={(event) => event.target.value && onChange({ to: event.target.value })} />
        </Field>
      </div>
    </div>
  );
}
