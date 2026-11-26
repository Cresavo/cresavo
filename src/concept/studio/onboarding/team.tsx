"use client";

import { useEffect, useRef } from "react";
import { Plus, X } from "lucide-react";
import { t } from "../../i18n";
import { MAX_PEOPLE, MAX_PERSON_NAME } from "../../onboarding/salon";
import { Button, IconButton } from "../../ui/button";
import { ChoiceCards, Field, TextInput } from "../../ui/controls";

type Mode = "solo" | "team";

/** Just the owner, or the owner and a few colleagues. Everyone gets a calendar and every treatment. */
export function SetupTeam({ people, change }: { people: string[]; change: (people: string[]) => void }) {
  const owner = people[0] ?? "";
  const colleagues = people.slice(1);
  const mode: Mode = colleagues.length ? "team" : "solo";
  const added = useRef<HTMLInputElement>(null);
  const focusAdded = useRef(false);
  useEffect(() => {
    // A row added with "Add a colleague" gets the cursor; choosing a team keeps focus on the choice.
    if (focusAdded.current) added.current?.focus();
    focusAdded.current = false;
  }, [colleagues.length]);
  const setColleague = (index: number, name: string) => change([owner, ...colleagues.map((other, i) => i === index ? name : other)]);
  return <div className="space-y-6">
    <ChoiceCards<Mode> label={t("setup.team")} value={mode}
      options={[{ value: "solo", label: t("setup.solo") }, { value: "team", label: t("setup.withTeam") }]}
      onChange={next => change(next === "solo" ? [owner] : [owner, ""])} />
    <Field width="short" label={t("setup.yourName")} hint={t("setup.yourNameHint")}>
      <TextInput autoComplete="name" maxLength={MAX_PERSON_NAME} value={owner} onChange={e => change([e.target.value, ...colleagues])} />
    </Field>
    {mode === "team" && <div className="space-y-3">
      {colleagues.map((name, i) => {
        const label = t("setup.colleague", { number: i + 1 });
        return <div key={i} className="flex items-end gap-1 md:max-w-field-short">
          <Field label={label}>
            <TextInput ref={i === colleagues.length - 1 ? added : undefined} autoComplete="off" maxLength={MAX_PERSON_NAME} value={name}
              onChange={e => setColleague(i, e.target.value)} />
          </Field>
          <IconButton label={t("setup.remove", { name: name.trim() || label })}
            onClick={() => change([owner, ...colleagues.filter((_, n) => n !== i)])}><X size={18} /></IconButton>
        </div>;
      })}
      {people.length < MAX_PEOPLE && <Button variant="tertiary" className="-ml-2" icon={<Plus size={16} />}
        onClick={() => { focusAdded.current = true; change([...people, ""]); }}>{t("setup.addColleague")}</Button>}
    </div>}
  </div>;
}
