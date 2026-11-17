"use client";

import { setRole, staffViewer, useRole, type Role } from "../../ops/access";
import { t } from "../../i18n";
import { Segmented } from "../../ui/controls";
import { useStudio } from "../use-studio";

/** Demo control: look at the studio as the owner or as a staff member. Hidden in a one-person business. */
export function RoleSwitch() {
  const { state } = useStudio();
  const role = useRole();
  const viewer = staffViewer(state);
  if (!viewer) return null;
  return (
    <Segmented<Role>
      label={t("role.label")}
      value={role}
      onChange={setRole}
      options={[
        { value: "owner", label: t("role.owner") },
        { value: "staff", label: t("role.staff", { name: viewer.firstName }) },
      ]}
    />
  );
}
