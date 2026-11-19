"use client";

import { useState, type FormEvent } from "react";
import { BookMarked, MessagesSquare, Pencil, Trash2 } from "lucide-react";
import { memoryRejection, searchMemory, type MemoryItem } from "../../assistant/memory";
import { t, tc } from "../../i18n";
import { formatDayMonth } from "../../i18n/format";
import { dispatch } from "../../store";
import { Button, IconButton } from "../../ui/button";
import { Card, Section } from "../../ui/card";
import { SearchInput, TextInput } from "../../ui/controls";
import { EmptyState } from "../../ui/empty-state";
import { useStudio } from "../use-studio";
import { dispatchWithUndoToast } from "../log/undo-toast";

/** "What … remembers": every note the assistant keeps, to search, edit and forget. A tab on the assistant's page. */
export function MemoryPanel() {
  const { state, today } = useStudio();
  const [query, setQuery] = useState("");
  const found = searchMemory(state.memory, query);
  const notes = found.filter((item) => item.kind !== "thread");
  const threads = found.filter((item) => item.kind === "thread");

  return (
      <div className="space-y-6">
        <p className="max-w-2xl text-body text-text-secondary">{tc("memory.subtitle", state.memory.length)} · {t("memory.intro")}</p>
        <AddNote today={today} />
        {state.memory.length > 0 && <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("memory.search")} aria-label={t("memory.search")} />}
        {!state.memory.length ? (
          <EmptyState icon={<BookMarked size={22} />} title={t("memory.emptyTitle")} text={t("memory.emptyText")} />
        ) : (
          <>
            <Section title={t("memory.notes")}>
              {notes.length ? <NoteList items={notes} /> : <p className="text-sm text-text-secondary">{t("memory.noMatch")}</p>}
            </Section>
            {threads.length > 0 && (
              <Section title={t("memory.threads")}>
                <NoteList items={threads} />
              </Section>
            )}
          </>
        )}
      </div>
  );
}

function AddNote({ today }: { today: string }) {
  const { state } = useStudio();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const rejection = memoryRejection(text, state);
    if (rejection) return setError(t(`assistant.memory.rejected.${rejection}`));
    if (dispatchWithUndoToast({ type: "memory/add", item: { text, kind: "fact", savedOn: today, source: "owner" } }, t("assistant.memory.saved"))) {
      setText("");
    }
  };
  return (
    <form onSubmit={submit} className="space-y-1.5">
      <div className="flex gap-2">
        <TextInput value={text} onChange={(event) => { setText(event.target.value); setError(null); }} placeholder={t("memory.addPlaceholder")} aria-label={t("memory.add")} />
        <Button type="submit" disabled={!text.trim()}>{t("memory.add")}</Button>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </form>
  );
}

function NoteList({ items }: { items: MemoryItem[] }) {
  return (
    <Card className="divide-y divide-hairline overflow-hidden">
      {items.map((item) => <Note key={item.id} item={item} />)}
    </Card>
  );
}

function Note({ item }: { item: MemoryItem }) {
  const { state } = useStudio();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);
  const [error, setError] = useState<string | null>(null);
  const save = (event: FormEvent) => {
    event.preventDefault();
    const rejection = memoryRejection(text, state);
    if (rejection) return setError(t(`assistant.memory.rejected.${rejection}`));
    dispatch({ type: "memory/edit", id: item.id, text });
    setEditing(false);
  };
  const forget = () => {
    dispatchWithUndoToast({ type: "memory/forget", id: item.id }, t("memory.forgotten"));
  };
  const Icon = item.kind === "thread" ? MessagesSquare : BookMarked;
  return (
    <div className="flex gap-3 px-4 py-3">
      <Icon size={18} className="mt-0.5 shrink-0 text-action" />
      {editing ? (
        <form onSubmit={save} className="min-w-0 flex-1 space-y-2">
          <TextInput value={text} onChange={(event) => { setText(event.target.value); setError(null); }} aria-label={t("memory.edit")} autoFocus />
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm">{t("common.save")}</Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setText(item.text); setError(null); }}>{t("common.cancel")}</Button>
          </div>
        </form>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <p className="text-[15px]">{item.text}</p>
            <p className="text-xs text-text-secondary">{t(item.kind === "thread" ? "memory.source.thread" : `memory.source.${item.source}`)} · {formatDayMonth(item.savedOn)}</p>
          </div>
          <IconButton label={t("memory.edit")} onClick={() => setEditing(true)} className="-my-1 size-10"><Pencil size={16} /></IconButton>
          <IconButton label={t("memory.forget")} onClick={forget} className="-my-1 -mr-2 size-10"><Trash2 size={16} /></IconButton>
        </>
      )}
    </div>
  );
}
