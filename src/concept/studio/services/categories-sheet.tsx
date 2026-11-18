"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import type { DemoState } from "../../data/types";
import { t, tc } from "../../i18n";
import { categoryIssues, MAX_NAME } from "../../services/edit";
import { dispatch } from "../../store";
import { Button, IconButton } from "../../ui/button";
import { TextInput } from "../../ui/controls";
import { Sheet } from "../../ui/sheet";
import { dispatchWithUndoToast } from "../log/undo-toast";

const NEW = "new";

/** The price list's headings: add, rename, reorder, and remove the ones that are empty. */
export function CategoriesSheet({ state, onClose }: { state: DemoState; onClose: () => void }) {
  /** Id of the category being renamed, `NEW` while adding one. */
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const issue = editing ? categoryIssues(state, name, editing === NEW ? undefined : editing)[0] : undefined;

  const start = (id: string, current: string) => {
    setEditing(id);
    setName(current);
  };
  const save = () => {
    if (!editing || issue) return;
    if (editing === NEW) {
      dispatchWithUndoToast({ type: "category/add", name }, t("services.category.added", { name: name.trim() }));
    } else {
      dispatchWithUndoToast({ type: "category/rename", id: editing, name }, t("services.category.renamed", { name: name.trim() }));
    }
    setEditing(null);
  };
  const remove = (id: string, label: string) => {
    dispatchWithUndoToast({ type: "category/remove", id }, t("services.category.removed", { name: label }));
  };

  const editor = (label: string) => (
    <form className="space-y-1.5 py-2" onSubmit={(event) => { event.preventDefault(); save(); }}>
      <div className="flex items-center gap-1">
        <TextInput value={name} maxLength={MAX_NAME} onChange={(e) => setName(e.target.value)} aria-label={label} aria-invalid={!!issue} autoFocus />
        <IconButton label={t("common.save")} type="submit" disabled={!!issue}><Check size={18} /></IconButton>
        <IconButton label={t("common.cancel")} onClick={() => setEditing(null)}><X size={18} /></IconButton>
      </div>
      {issue && name.trim() !== "" && <p role="alert" className="text-xs text-danger">{t(`services.category.issue.${issue}`)}</p>}
    </form>
  );

  return (
    <Sheet open onClose={onClose} title={t("services.categories")} description={t("services.category.hint")} footer={<Button variant="secondary" onClick={onClose}>{t("common.close")}</Button>}>
      <ul className="divide-y divide-hairline">
        {state.categories.map((category, index) => {
          const count = state.services.filter((s) => s.category === category.id).length;
          return (
            <li key={category.id}>
              {editing === category.id ? (
                editor(t("services.category.rename", { name: category.name }))
              ) : (
                <div className="flex items-center gap-1 py-1.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{category.name}</span>
                    <span className="block text-xs text-text-secondary">{count ? tc("services.category.count", count) : t("services.empty")}</span>
                  </span>
                  <IconButton label={t("services.category.moveUp", { name: category.name })} disabled={index === 0} onClick={() => dispatch({ type: "category/move", id: category.id, direction: "up" })}><ArrowUp size={18} /></IconButton>
                  <IconButton label={t("services.category.moveDown", { name: category.name })} disabled={index === state.categories.length - 1} onClick={() => dispatch({ type: "category/move", id: category.id, direction: "down" })}><ArrowDown size={18} /></IconButton>
                  <IconButton label={t("services.category.rename", { name: category.name })} onClick={() => start(category.id, category.name)}><Pencil size={16} /></IconButton>
                  <IconButton
                    label={count ? `${t("services.category.remove", { name: category.name })}: ${t("services.category.inUse")}` : t("services.category.remove", { name: category.name })}
                    disabled={count > 0}
                    onClick={() => remove(category.id, category.name)}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-2 border-t border-hairline pt-2">
        {editing === NEW ? editor(t("services.category.name")) : <Button variant="ghost" size="sm" icon={<Plus size={16} />} onClick={() => start(NEW, "")}>{t("services.category.add")}</Button>}
      </div>
    </Sheet>
  );
}
