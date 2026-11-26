"use client";

import { useRouter } from "next/navigation";
import { t } from "../../i18n";
import { staffViewer } from "../../ops/access";
import { setRole } from "../../ops/role";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { useStudio } from "../use-studio";

export function RoleSwitch() {
  const { state } = useStudio();
  const router = useRouter();
  const viewer = staffViewer(state);
  if (!viewer) return null;

  return (
    <Card className="space-y-3 p-4">
      <p className="text-body text-text-secondary">{t("role.previewText", { name: viewer.firstName })}</p>
      <Button variant="secondary" data-help="role-switch" data-help-id="advanced.staff-preview" onClick={() => {
        setRole("staff");
        router.push("/studio");
      }}>
        {t("role.preview")}
      </Button>
    </Card>
  );
}

export function StaffPreviewBar({ name }: { name: string }) {
  return (
    <Card className="mb-3 flex flex-wrap items-center justify-between gap-2 px-3 py-1">
      <p className="text-meta text-text-secondary">{t("role.previewing", { name })}</p>
      <Button variant="tertiary" onClick={() => setRole("owner")}>{t("role.exitPreview")}</Button>
    </Card>
  );
}
