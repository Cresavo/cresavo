"use client";

import { useState } from "react";
import { Armchair, DoorOpen, Pencil, Plus, Wrench } from "lucide-react";
import type { Resource, ResourceKind } from "../../data/types";
import { t, tc } from "../../i18n";
import { dispatch } from "../../store";
import { Button } from "../../ui/button";
import { Card, Section } from "../../ui/card";
import { Chip, Field, Segmented, TextInput } from "../../ui/controls";
import { Sheet } from "../../ui/sheet";
import { useStudio } from "../use-studio";

const ICONS = { room: DoorOpen, chair: Armchair, equipment: Wrench };
const KINDS: ResourceKind[] = ["room", "chair", "equipment"];

/** Rooms, chairs and equipment: a booking occupies one, and two bookings can never share it. */
export function ResourcesSection() {
  const { state } = useStudio();
  const [editing, setEditing] = useState<Resource | "new" | null>(null);
  return (
    <Section
      title={t("resources.title")}
      action={<Button size="sm" variant="secondary" icon={<Plus size={16} />} onClick={() => setEditing("new")}>{t("resources.add")}</Button>}
    >
      <Card className="divide-y divide-eko-line">
        {state.resources.length ? (
          state.resources.map((r) => {
            const Icon = ICONS[r.kind];
            const uses = state.services.filter((s) => s.resourceIds?.includes(r.id)).length;
            return (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <Icon size={18} className="shrink-0 text-eko-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{r.name}</span>
                  <span className="block text-eko-muted">{t(`resources.kind.${r.kind}`)} · {tc("resources.usedBy", uses)}</span>
                </span>
                <Button size="sm" variant="ghost" icon={<Pencil size={16} />} onClick={() => setEditing(r)}>{t("common.edit")}</Button>
              </div>
            );
          })
        ) : (
          <p className="px-4 py-4 text-sm text-eko-muted">{t("resources.none")}</p>
        )}
      </Card>
      <p className="text-xs text-eko-muted">{t("resources.hint")}</p>
      {editing && <ResourceSheet resource={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Section>
  );
}

function ResourceSheet({ resource, onClose }: { resource: Resource | null; onClose: () => void }) {
  const { state } = useStudio();
  const [name, setName] = useState(resource?.name ?? "");
  const [kind, setKind] = useState<ResourceKind>(resource?.kind ?? "room");
  const [users, setUsers] = useState(() => new Set(state.services.filter((s) => resource && s.resourceIds?.includes(resource.id)).map((s) => s.id)));
  const toggle = (id: string) => setUsers((current) => new Set(current.has(id) ? [...current].filter((x) => x !== id) : [...current, id]));

  const save = () => {
    if (!resource) {
      dispatch({ type: "resource/add", name, kind });
      onClose();
      return;
    }
    if (name.trim() !== resource.name) dispatch({ type: "resource/rename", id: resource.id, name });
    for (const service of state.services) {
      const had = service.resourceIds?.includes(resource.id) ?? false;
      if (had === users.has(service.id)) continue;
      const others = (service.resourceIds ?? []).filter((id) => id !== resource.id);
      dispatch({ type: "service/resources", id: service.id, resourceIds: users.has(service.id) ? [...others, resource.id] : others });
    }
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={resource ? t("resources.edit") : t("resources.add")}
      footer={
        <>
          {resource && <Button variant="danger" className="mr-auto" onClick={() => { dispatch({ type: "resource/remove", id: resource.id }); onClose(); }}>{t("common.remove")}</Button>}
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={!name.trim()} onClick={save}>{t("common.save")}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label={t("resources.name")}>
          <TextInput value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        {!resource && (
          <Segmented<ResourceKind> label={t("resources.kind")} value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k, label: t(`resources.kind.${k}`) }))} />
        )}
        {resource && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("resources.usedFor")}</p>
            <div className="flex flex-wrap gap-2">
              {state.services.map((s) => (
                <Chip key={s.id} active={users.has(s.id)} onClick={() => toggle(s.id)}>{s.name}</Chip>
              ))}
            </div>
            <p className="text-xs text-eko-muted">{t("resources.usedForHint")}</p>
          </div>
        )}
      </div>
    </Sheet>
  );
}
