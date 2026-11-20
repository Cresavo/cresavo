import type { Staff } from "../data/types";
import { t } from "../i18n";
import { StaffAvatar } from "../ui/avatar";

/** Keep a treatment's staff together when the metadata wraps on a phone. `faces` off leaves the names alone, for long lists where the same face would repeat. */
export function WithStaff({ people, faces = true }: { people: Staff[]; faces?: boolean }) {
  if (!people.length) return null;
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-2 align-middle">
      {faces && people.map((person) => <StaffAvatar key={person.id} person={person} size="xs" />)}
      <span className="min-w-0 break-words">{t("booking.withStaff", { name: people.map((person) => person.firstName).join(", ") })}</span>
    </span>
  );
}
