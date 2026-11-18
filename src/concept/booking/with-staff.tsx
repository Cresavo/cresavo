import type { Staff } from "../data/types";
import { t } from "../i18n";
import { StaffAvatar } from "../ui/avatar";

/** Keep a treatment's staff together when the metadata wraps on a phone. */
export function WithStaff({ people }: { people: Staff[] }) {
  if (!people.length) return null;
  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      {people.map((person) => <StaffAvatar key={person.id} person={person} size="xs" />)}
      {t("booking.withStaff", { name: people.map((person) => person.firstName).join(", ") })}
    </span>
  );
}
