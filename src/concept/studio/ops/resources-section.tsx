"use client";

import { useRef, useState } from "react";
import { Armchair, DoorOpen, Pencil, Plus, Wrench } from "lucide-react";
import type { Resource, ResourceKind } from "../../data/types";
import { t, tc } from "../../i18n";
import { dispatch } from "../../store";
import { Button } from "../../ui/button";
import { Card, Section } from "../../ui/card";
import { Chip, Field, Segmented, TextInput } from "../../ui/controls";
import { Sheet } from "../../ui/sheet";
import { useStudio } from "../use-studio";
import { AddRow } from "./add-row";

const ICONS = { room: DoorOpen, chair: Armchair, equipment: Wrench };
const KINDS: ResourceKind[] = ["room", "chair", "equipment"];

/** Rooms, chairs and equipment: a booking occupies one, and two bookings can never share it. A new one is added in the list. */
export function ResourcesSection() {
  const { state } = useStudio();
  const [editing, setEditing] = useState<Resource | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ResourceKind>("room");
  const addButton = useRef<HTMLButtonElement>(null);
  const close = () => {
    setAdding(false);
    setName("");
    setKind("room");
  };
  return (
    <Section
      title={t("resources.title")}
      action={<Button ref={addButton} size="sm" variant="secondary" icon={<Plus size={16} />} aria-expanded={adding} onClick={() => (adding ? close() : setAdding(true))}>{t("resources.add")}</Button>}
    >
      <Card>
        <AddRow open={adding} label={t("resources.add")} submitLabel={t("common.add")} canSubmit={!!name.trim()} trigger={addButton} onClose={close}
          onSubmit={() => dispatch({ type: "resource/add", name, kind })}>
          <div className="flex flex-wrap items-end gap-4">
            <Field width="short" label={t("resources.name")}>
              <TextInput value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Segmented<ResourceKind> label={t("resources.kind")} value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k, label: t(`resources.kind.${k}`) }))} />
          </div>
        </AddRow>
        <div className="divide-y divide-hairline">
          {state.resources.length ? (
            state.resources.map((r) => {
              const Icon = ICONS[r.kind];
              const uses = state.services.filter((s) => s.resourceIds?.includes(r.id)).length;
              return (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <Icon size={18} className="shrink-0 text-text-secondary" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{r.name}</span>
                    <span className="block text-text-secondary">{t(`resources.kind.${r.kind}`)} · {tc("resources.usedBy", uses)}</span>
                  </span>
                  <Button size="sm" variant="ghost" icon={<Pencil size={16} />} onClick={() => setEditing(r)}>{t("common.edit")}</Button>
                </div>
              );
            })
          ) : (
            <p className="px-4 py-4 text-sm text-text-secondary">{t("resources.none")}</p>
          )}
        </div>
      </Card>
      <p className="text-xs text-text-secondary">{t("resources.hint")}</p>
      {editing && <ResourceSheet resource={editing} onClose={() => setEditing(null)} />}
    </Section>
  );
}

/** The fuller editor for an existing room: its name, the treatments that use it, or removing it. */
function ResourceSheet({ resource, onClose }: { resource: Resource; onClose: () => void }) {
  const { state } = useStudio();
  const [name, setName] = useState(resource.name);
  const [users, setUsers] = useState(() => new Set(state.services.filter((s) => s.resourceIds?.includes(resource.id)).map((s) => s.id)));
  const toggle = (id: string) => setUsers((current) => new Set(current.has(id) ? [...current].filter((x) => x !== id) : [...current, id]));

  const save = () => {
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
      title={t("resources.edit")}
      footer={
        <>
          <Button variant="danger" className="mr-auto" onClick={() => { dispatch({ type: "resource/remove", id: resource.id }); onClose(); }}>{t("common.remove")}</Button>
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button width="responsive" disabled={!name.trim()} onClick={save}>{t("common.save")}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field width="short" label={t("resources.name")}>
          <TextInput value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("resources.usedFor")}</p>
          <div className="flex flex-wrap gap-2">
            {state.services.map((s) => (
              <Chip key={s.id} active={users.has(s.id)} onClick={() => toggle(s.id)}>{s.name}</Chip>
            ))}
          </div>
          <p className="text-xs text-text-secondary">{t("resources.usedForHint")}</p>
        </div>
      </div>
    </Sheet>
  );
}
