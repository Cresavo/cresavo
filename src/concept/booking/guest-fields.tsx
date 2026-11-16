import { t } from "../i18n";
import { Field, TextInput } from "../ui/controls";
import { normalizePhone } from "./lookup";

export interface GuestInput {
  name: string;
  phone: string;
}

export function isGuestValid({ name, phone }: GuestInput): boolean {
  return name.trim().length >= 2 && normalizePhone(phone).length >= 7;
}

/** Name and mobile number: the only things a first-time booker has to type. */
export function GuestFields({ value, onChange }: { value: GuestInput; onChange: (next: GuestInput) => void }) {
  return (
    <div className="space-y-4">
      <Field label={t("booking.yourName")}>
        <TextInput value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} autoComplete="name" placeholder={t("booking.namePlaceholder")} />
      </Field>
      <Field label={t("booking.yourPhone")} hint={t("booking.phoneHint")}>
        <TextInput value={value.phone} onChange={(e) => onChange({ ...value, phone: e.target.value })} type="tel" inputMode="tel" autoComplete="tel" placeholder={t("booking.phonePlaceholder")} />
      </Field>
    </div>
  );
}
