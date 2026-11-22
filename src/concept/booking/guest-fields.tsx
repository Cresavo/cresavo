import { t } from "../i18n";
import { Checkbox, Field, Segmented, TextInput } from "../ui/controls";
import { isMobilePhone } from "./lookup";
import { VISIT_FOR_MAX } from "./visit-for";

export interface GuestInput {
  name: string;
  phone: string;
}

export function isGuestValid({ name, phone }: GuestInput): boolean {
  return name.trim().length >= 2 && isMobilePhone(phone);
}

/** Name and mobile number: the only things a first-time booker has to type. */
export function GuestFields({ value, onChange, staffEntry = false, disabled = false }: { value: GuestInput; onChange: (next: GuestInput) => void; staffEntry?: boolean; disabled?: boolean }) {
  return (
    <div className="space-y-4">
      <Field label={t(staffEntry ? "newBooking.customerName" : "booking.yourName")}>
        <TextInput required={!staffEntry} disabled={disabled} value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} autoComplete="name" placeholder={t("booking.namePlaceholder")} />
      </Field>
      <Field label={t(staffEntry ? "newBooking.customerPhone" : "booking.yourPhone")} hint={staffEntry ? undefined : t("booking.phoneHint")}>
        <TextInput required={!staffEntry} disabled={disabled} value={value.phone} onChange={(e) => onChange({ ...value, phone: e.target.value })} type="tel" inputMode="tel" autoComplete="tel" placeholder={t("booking.phonePlaceholder")} />
      </Field>
    </div>
  );
}

export type VisitWho = "me" | "other";

/** "For me" or "For someone else"; the second asks who is coming, and the fields below stay the contact person's. */
export function VisitForChoice({ who, onWho, name, onName, disabled = false }: { who: VisitWho; onWho: (who: VisitWho) => void; name: string; onName: (name: string) => void; disabled?: boolean }) {
  return (
    <div className="space-y-4">
      <Segmented value={who} onChange={onWho} label={t("booking.for.label")} options={(["me", "other"] as const).map(value => ({ value, label: t(`booking.for.${value}`) }))} />
      {who === "other" && (
        <Field label={t("booking.for.name")} hint={t("booking.for.nameHint")}>
          <TextInput required disabled={disabled} value={name} onChange={(e) => onName(e.target.value)} autoComplete="off" maxLength={VISIT_FOR_MAX} placeholder={t("booking.namePlaceholder")} />
        </Field>
      )}
    </div>
  );
}

export function RememberContact({ checked, onChange, disabled = false }: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <Checkbox label={t("booking.rememberContact")} checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} />
  );
}
