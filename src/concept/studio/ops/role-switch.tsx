"use client";

import { UserRound } from "lucide-react";
import { staffViewer, type Role } from "../../ops/access";
import { setRole, useRole } from "../../ops/role";
import { t } from "../../i18n";
import { Segmented } from "../../ui/controls";
import { useStudio } from "../use-studio";

/**
 * Demo control: look at the studio as the owner or as a staff member. Hidden in a one-person business.
 * `compact` is the phone and tablet top bar's one-button toggle, reachable from both roles.
 */
export function RoleSwitch({ compact = false }: { compact?: boolean }) {
  const { state } = useStudio();
  const role = useRole();
  const viewer = staffViewer(state);
  if (!viewer) return null;
  if (compact) {
    const current = role === "owner" ? t("role.owner") : viewer.firstName;
    const next = role === "owner" ? t("role.staff", { name: viewer.firstName }) : t("role.owner");
    return (
      <button
        type="button"
        data-help="role-switch"
        onClick={() => setRole(role === "owner" ? "staff" : "owner")}
        aria-label={t("role.switch", { current, next })}
        title={t("role.switch", { current, next })}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-[15px] font-medium text-text-secondary hover:bg-surface-2 hover:text-text"
      >
        <UserRound size={18} aria-hidden />
        <span className="max-[299px]:sr-only">{current}</span>
      </button>
    );
  }
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
